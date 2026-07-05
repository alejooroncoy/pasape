import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { WalletTicket } from "../domain/Ticket";
import { supabaseTicketRepository } from "../infrastructure/repositories/SupabaseTicketRepository";
import { signOrderLink } from "@/server/notifications/domain/OrderLinkToken";

// Why: mock-OTP recovery flow for the pilot. We don't want to wire Firebase
// signInWithPhone for a "recover my QR" UX since the user may have lost
// their phone session. We store a 6-digit code in `ticket_recovery_otp`,
// log it to the server console (or return it in dev), and let the user
// verify it to fetch their active tickets.

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;

const isEmail = (s: string): boolean => /@/.test(s);
const normalizePhone = (s: string): string => s.replace(/[^\d+]/g, "");

export type StartRecoveryInput = { identifier: string };
export type StartRecoveryResult = {
  identifierKind: "phone" | "email";
  // In dev we leak the code so the pilot can be tested without SMS infra.
  devCode?: string;
};

const generateCode = (): string =>
  String(Math.floor(100000 + Math.random() * 900000));

export const startTicketRecovery = async (
  input: StartRecoveryInput,
): Promise<Result<StartRecoveryResult>> => {
  const raw = input.identifier.trim();
  if (!raw) return err("identifier_required");
  const kind: "phone" | "email" = isEmail(raw) ? "email" : "phone";
  const identifier = kind === "email" ? raw.toLowerCase() : normalizePhone(raw);
  if (kind === "phone" && identifier.length < 7) return err("invalid_phone");
  if (kind === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier))
    return err("invalid_email");

  const db = supabaseAdmin();

  // Best-effort profile lookup. We don't reveal whether the profile exists
  // (the verify step returns an empty list instead).
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq(kind === "email" ? "email" : "phone", identifier)
    .maybeSingle<{ id: string }>();

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

  const { error: insertErr } = await db.from("ticket_recovery_otp").insert({
    identifier,
    identifier_kind: kind,
    profile_id: profile?.id ?? null,
    code,
    expires_at: expiresAt,
  });
  if (insertErr) return err(insertErr.message);

  // Mock delivery — real infra (SMS/email) plugs in here later.
   
  console.log(`[ticket-recovery] OTP for ${identifier}: ${code}`);

  const out: StartRecoveryResult = { identifierKind: kind };
  if (process.env.NODE_ENV !== "production") out.devCode = code;
  return ok(out);
};

export type VerifyRecoveryInput = { identifier: string; code: string };
export type RecoveredOrderLink = { orderId: string; token: string };
export type VerifyRecoveryResult = {
  profileId: string | null;
  tickets: WalletTicket[];
  /** Un link firmado por cada orden distinta detrás de las entradas
   *  recuperadas — misma ruta /order/[id]/[token] que usa la entrega por
   *  WhatsApp/email. El profile del recovery es un guest sin sesión; el
   *  frontend debe llevar al usuario ahí (login + claimOrder) en vez de a
   *  /tickets, que exige una sesión que este flujo nunca crea. */
  orderLinks: RecoveredOrderLink[];
};

export const verifyTicketRecovery = async (
  input: VerifyRecoveryInput,
): Promise<Result<VerifyRecoveryResult>> => {
  const raw = input.identifier.trim();
  const code = input.code.trim();
  if (!raw || code.length !== 6) return err("invalid_input");
  const kind: "phone" | "email" = isEmail(raw) ? "email" : "phone";
  const identifier = kind === "email" ? raw.toLowerCase() : normalizePhone(raw);

  const db = supabaseAdmin();

  const { data: row } = await db
    .from("ticket_recovery_otp")
    .select("id, code, attempts, consumed_at, expires_at, profile_id")
    .eq("identifier", identifier)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      code: string;
      attempts: number;
      consumed_at: string | null;
      expires_at: string;
      profile_id: string | null;
    }>();

  if (!row) return err("code_not_found");
  if (new Date(row.expires_at).getTime() < Date.now()) return err("code_expired");
  if (row.attempts >= MAX_ATTEMPTS) return err("too_many_attempts");

  if (row.code !== code) {
    await db
      .from("ticket_recovery_otp")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return err("invalid_code");
  }

  await db
    .from("ticket_recovery_otp")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);

  if (!row.profile_id) return ok({ profileId: null, tickets: [], orderLinks: [] });

  const tickets = await supabaseTicketRepository.listMine(row.profile_id);
  // Why: only surface usable tickets in the recovery flow.
  const active = tickets.filter((t) => t.status === "active");

  const orderIds = [...new Set(active.map((t) => t.orderId))];
  const orderLinks: RecoveredOrderLink[] = orderIds.map((orderId) => ({
    orderId,
    token: signOrderLink(orderId),
  }));

  return ok({ profileId: row.profile_id, tickets: active, orderLinks });
};

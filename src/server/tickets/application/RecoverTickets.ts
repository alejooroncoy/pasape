import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { WalletTicket } from "../domain/Ticket";
import { supabaseTicketRepository } from "../infrastructure/repositories/SupabaseTicketRepository";
import { signOrderLink } from "@/server/notifications/domain/OrderLinkToken";

const OTP_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const MAX_STARTS_PER_HOUR = 5;

const isEmail = (s: string): boolean => /@/.test(s);
const normalizePhone = (s: string): string => s.replace(/[^\d+]/g, "");

export type StartRecoveryInput = { identifier: string };
export type StartRecoveryResult = {
  identifierKind: "phone" | "email";
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

  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count: recentStarts } = await db
    .from("ticket_recovery_otp")
    .select("id", { count: "exact", head: true })
    .eq("identifier", identifier)
    .gte("created_at", since);
  if ((recentStarts ?? 0) >= MAX_STARTS_PER_HOUR) return err("too_many_attempts");

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString();

  const { error: insertErr } = await db.from("ticket_recovery_otp").insert({
    identifier,
    identifier_kind: kind,
    profile_id: null,
    code,
    expires_at: expiresAt,
  });
  if (insertErr) return err(insertErr.message);

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

  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: attemptRows } = await db
    .from("ticket_recovery_otp")
    .select("attempts")
    .eq("identifier", identifier)
    .gte("created_at", since);
  const totalAttempts = (attemptRows ?? []).reduce(
    (sum, r) => sum + ((r as { attempts: number }).attempts ?? 0),
    0,
  );
  if (totalAttempts >= MAX_ATTEMPTS * MAX_STARTS_PER_HOUR) return err("too_many_attempts");

  const { data: row } = await db
    .from("ticket_recovery_otp")
    .select("id, code, attempts, consumed_at, expires_at")
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

  // Fuente de verdad: contacto guest en orders (no profiles.email sintético).
  let orderQuery = db.from("orders").select("id, buyer_id").eq("status", "paid");
  if (kind === "email") {
    orderQuery = orderQuery.ilike("guest_email", identifier);
  } else {
    const digits = identifier.replace(/\D/g, "");
    orderQuery = orderQuery.or(`guest_phone.ilike.%${digits}%,guest_phone.eq.${identifier}`);
  }
  const { data: orders } = await orderQuery.returns<Array<{ id: string; buyer_id: string | null }>>();
  if (!orders?.length) return ok({ profileId: null, tickets: [], orderLinks: [] });

  const orderIds = orders.map((o) => o.id);
  const { data: ticketRows } = await db
    .from("tickets")
    .select("id, order_id, status, current_holder")
    .in("order_id", orderIds)
    .eq("status", "active");

  const holderIds = [...new Set((ticketRows ?? []).map((t) => (t as { current_holder: string }).current_holder))];
  const allTickets: WalletTicket[] = [];
  for (const holderId of holderIds) {
    const mine = await supabaseTicketRepository.listMine(holderId);
    allTickets.push(...mine.filter((t) => t.status === "active" && orderIds.includes(t.orderId)));
  }

  const uniqueTickets = [...new Map(allTickets.map((t) => [t.id, t])).values()];
  const recoveredOrderIds = [...new Set(uniqueTickets.map((t) => t.orderId))];
  const orderLinks: RecoveredOrderLink[] = recoveredOrderIds.map((orderId) => ({
    orderId,
    token: signOrderLink(orderId),
  }));

  return ok({
    profileId: holderIds[0] ?? null,
    tickets: uniqueTickets,
    orderLinks,
  });
};

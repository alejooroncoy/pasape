import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getRedis } from "@/server/_shared/redis";
import { err, ok, type Result } from "@/server/_shared/result";
import type { WalletTicket } from "../domain/Ticket";
import { supabaseTicketRepository } from "../infrastructure/repositories/SupabaseTicketRepository";
import { signOrderLink } from "@/server/notifications/domain/OrderLinkToken";
import { sendRecoveryOtpEmail } from "@/server/notifications/infrastructure/ResendRecoveryOtpSender";

// Recuperación de entradas: solo por correo. No hay proveedor de SMS/WhatsApp
// OTP contratado (Twilio y la plantilla "Authentication" de WhatsApp piden
// verificación de negocio o cuestan por envío — ver research), así que pedir
// "celular" acá prometería una vía que el backend no puede entregar de
// verdad. El código vive en Redis (Upstash) con TTL — nada que limpiar a mano.

const OTP_TTL_MIN = 10;
const OTP_TTL_SECONDS = OTP_TTL_MIN * 60;
const MAX_ATTEMPTS = 5;
const MAX_STARTS_PER_HOUR = 5;
const STARTS_WINDOW_SECONDS = 60 * 60;

const normalizeEmail = (s: string): string => s.trim().toLowerCase();
const isValidEmail = (s: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const generateCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

type OtpRecord = { code: string; attempts: number };

const otpKey = (email: string): string => `recover:otp:${email}`;
const startsKey = (email: string): string => `recover:starts:${email}`;

export type StartRecoveryInput = { identifier: string };
export type StartRecoveryResult = { devCode?: string };

export const startTicketRecovery = async (
  input: StartRecoveryInput,
): Promise<Result<StartRecoveryResult>> => {
  const email = normalizeEmail(input.identifier);
  if (!email) return err("identifier_required");
  if (!isValidEmail(email)) return err("invalid_email");

  const redis = getRedis();
  if (!redis) return err("recovery_not_configured");

  const starts = await redis.incr(startsKey(email));
  if (starts === 1) await redis.expire(startsKey(email), STARTS_WINDOW_SECONDS);
  if (starts > MAX_STARTS_PER_HOUR) return err("too_many_attempts");

  const code = generateCode();
  const record: OtpRecord = { code, attempts: 0 };
  await redis.set(otpKey(email), record, { ex: OTP_TTL_SECONDS });

  const { sent } = await sendRecoveryOtpEmail({ to: email, code, ttlMinutes: OTP_TTL_MIN });
  // En prod el correo es el único canal — si no salió, que el usuario lo sepa
  // en vez de esperar un código que nunca va a llegar. En dev seguimos aunque
  // falle Resend (sin envs locales) porque `devCode` cubre el flujo.
  if (!sent && process.env.NODE_ENV === "production") return err("email_send_failed");

  console.log(`[ticket-recovery] OTP for ${email}: ${code}`);

  const out: StartRecoveryResult = {};
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
  const email = normalizeEmail(input.identifier);
  const code = input.code.trim();
  if (!email || code.length !== 6) return err("invalid_input");

  const redis = getRedis();
  if (!redis) return err("recovery_not_configured");

  const record = await redis.get<OtpRecord>(otpKey(email));
  // Sin registro = nunca se pidió, o ya venció el TTL (10 min) — mismo error,
  // el usuario resuelve igual: pide un código nuevo.
  if (!record) return err("code_not_found");
  if (record.attempts >= MAX_ATTEMPTS) return err("too_many_attempts");

  if (record.code !== code) {
    const ttl = await redis.ttl(otpKey(email));
    await redis.set(otpKey(email), { ...record, attempts: record.attempts + 1 }, {
      ex: ttl > 0 ? ttl : OTP_TTL_SECONDS,
    });
    return err("invalid_code");
  }

  await redis.del(otpKey(email));

  const db = supabaseAdmin();

  // Fuente de verdad: contacto guest en orders (no profiles.email sintético).
  const { data: orders } = await db
    .from("orders")
    .select("id, buyer_id")
    .eq("status", "paid")
    .ilike("guest_email", email)
    .returns<Array<{ id: string; buyer_id: string | null }>>();
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

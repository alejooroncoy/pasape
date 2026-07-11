import { getRedis } from "@/server/_shared/redis";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { verifyOrderLink } from "@/server/notifications/domain/OrderLinkToken";
import { sendPasskeyUnlockEmail } from "@/server/notifications/infrastructure/ResendPasskeyUnlockSender";

// Código de desbloqueo (primera vez, antes de tener passkey). Mismo patrón
// Redis+TTL+rate-limit que RecoverTickets.ts, namespace "passkey" propio para
// no compartir intentos/tope con la recuperación de entradas.

const OTP_TTL_MIN = 10;
const OTP_TTL_SECONDS = OTP_TTL_MIN * 60;
export const MAX_ATTEMPTS = 5;
const MAX_STARTS_PER_HOUR = 5;
const STARTS_WINDOW_SECONDS = 60 * 60;

const normalizeEmail = (s: string): string => s.trim().toLowerCase();
const isValidEmail = (s: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const generateCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

const maskEmail = (email: string): string => {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 1)}${"*".repeat(Math.max(user.length - 1, 3))}@${domain}`;
};

export type OtpRecord = { code: string; attempts: number };
export const otpKey = (email: string): string => `passkey:otp:${email}`;
const startsKey = (email: string): string => `passkey:starts:${email}`;

export type EmailUnlockSource =
  | { source: "order"; orderId: string; token: string }
  | { source: "generic"; email: string };

// Fuente de verdad del correo real por contexto: en "order" viene de
// orders.guest_email (nunca se expone al cliente); en "generic" es el que el
// usuario tipeó. Compartido entre start y verify para no duplicar la lógica.
export const resolveUnlockEmail = async (
  input: EmailUnlockSource,
): Promise<Result<string>> => {
  if (input.source === "order") {
    if (!verifyOrderLink(input.orderId, input.token)) return err("invalid_token");
    const db = supabaseAdmin();
    const { data: order } = await db
      .from("orders")
      .select("guest_email")
      .eq("id", input.orderId)
      .maybeSingle<{ guest_email: string | null }>();
    const guestEmail = order?.guest_email ? normalizeEmail(order.guest_email) : "";
    if (!guestEmail) return err("no_email_on_order");
    return ok(guestEmail);
  }

  const email = normalizeEmail(input.email);
  if (!email) return err("identifier_required");
  if (!isValidEmail(email)) return err("invalid_email");
  return ok(email);
};

export type StartEmailUnlockResult = { emailHint: string; devCode?: string };

export const startEmailUnlock = async (
  input: EmailUnlockSource,
): Promise<Result<StartEmailUnlockResult>> => {
  const emailRes = await resolveUnlockEmail(input);
  if (!emailRes.ok) return emailRes;
  const email = emailRes.value;

  const redis = getRedis();
  if (!redis) return err("recovery_not_configured");

  const starts = await redis.incr(startsKey(email));
  if (starts === 1) await redis.expire(startsKey(email), STARTS_WINDOW_SECONDS);
  if (starts > MAX_STARTS_PER_HOUR) return err("too_many_attempts");

  const code = generateCode();
  const record: OtpRecord = { code, attempts: 0 };
  await redis.set(otpKey(email), record, { ex: OTP_TTL_SECONDS });

  const { sent } = await sendPasskeyUnlockEmail({ to: email, code, ttlMinutes: OTP_TTL_MIN });
  if (!sent && process.env.NODE_ENV === "production") return err("email_send_failed");

  console.log(`[passkey-unlock] OTP for ${email}: ${code}`);

  const out: StartEmailUnlockResult = { emailHint: maskEmail(email) };
  if (process.env.NODE_ENV !== "production") out.devCode = code;
  return ok(out);
};

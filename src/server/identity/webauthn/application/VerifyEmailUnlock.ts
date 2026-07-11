import { getRedis } from "@/server/_shared/redis";
import { err, ok, type Result } from "@/server/_shared/result";
import {
  MAX_ATTEMPTS,
  otpKey,
  resolveUnlockEmail,
  type EmailUnlockSource,
  type OtpRecord,
} from "./StartEmailUnlock";
import { mintSessionForProfile } from "./MintSessionForProfile";

const OTP_TTL_SECONDS = 10 * 60;

export type VerifyEmailUnlockInput = EmailUnlockSource & { code: string };
export type VerifyEmailUnlockResult = { profileId: string };

// Valida el código y mintea sesión con el mismo mecanismo que el passkey
// (MintSessionForProfile) — generateLink(magiclink) crea el auth.user si no
// existía (dispara handle_new_user), así que no hace falta buscar/crear el
// profile a mano acá.
export const verifyEmailUnlock = async (
  input: VerifyEmailUnlockInput,
): Promise<Result<VerifyEmailUnlockResult>> => {
  const emailRes = await resolveUnlockEmail(input);
  if (!emailRes.ok) return emailRes;
  const email = emailRes.value;

  const code = input.code.trim();
  if (code.length !== 6) return err("invalid_input");

  const redis = getRedis();
  if (!redis) return err("recovery_not_configured");

  const record = await redis.get<OtpRecord>(otpKey(email));
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

  const minted = await mintSessionForProfile(email);
  if (!minted.ok) return minted;

  return ok({ profileId: minted.value.profileId });
};

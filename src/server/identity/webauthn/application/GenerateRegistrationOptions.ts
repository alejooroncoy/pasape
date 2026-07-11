import "server-only";
import {
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { getRedis } from "@/server/_shared/redis";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseWebauthnCredentialRepository } from "../infrastructure/repositories/SupabaseWebauthnCredentialRepository";
import { rpID, rpName } from "../rpConfig";

const CHALLENGE_TTL_SECONDS = 5 * 60;
export const regChallengeKey = (profileId: string): string => `webauthn:reg-challenge:${profileId}`;

// Requiere sesión activa (ya la tiene tras el código de correo) — el passkey
// se registra PARA el usuario ya autenticado, no antes.
export const generatePasskeyRegistrationOptions = async (): Promise<
  Result<PublicKeyCredentialCreationOptionsJSON>
> => {
  const auth = await getAuthContext();
  if (!auth.ok) return err("unauthenticated");
  const { profileId, email } = auth.value;

  const redis = getRedis();
  if (!redis) return err("webauthn_not_configured");

  const existing = await supabaseWebauthnCredentialRepository.listByProfileId(profileId);

  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpID(),
    userName: email ?? profileId,
    userID: isoUint8Array.fromUTF8String(profileId),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });

  await redis.set(regChallengeKey(profileId), options.challenge, { ex: CHALLENGE_TTL_SECONDS });

  return ok(options);
};

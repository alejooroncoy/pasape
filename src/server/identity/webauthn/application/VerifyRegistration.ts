import "server-only";
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { getRedis } from "@/server/_shared/redis";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseWebauthnCredentialRepository } from "../infrastructure/repositories/SupabaseWebauthnCredentialRepository";
import { rpID, rpOrigin } from "../rpConfig";
import { regChallengeKey } from "./GenerateRegistrationOptions";

export const verifyPasskeyRegistration = async (
  response: RegistrationResponseJSON,
): Promise<Result<{ ok: true }>> => {
  const auth = await getAuthContext();
  if (!auth.ok) return err("unauthenticated");
  const { profileId } = auth.value;

  const redis = getRedis();
  if (!redis) return err("webauthn_not_configured");

  const challenge = await redis.get<string>(regChallengeKey(profileId));
  if (!challenge) return err("challenge_expired");

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: rpOrigin(),
      expectedRPID: rpID(),
    });
  } catch {
    return err("verification_failed");
  }
  if (!verification.verified || !verification.registrationInfo) return err("verification_failed");

  await redis.del(regChallengeKey(profileId));

  const { credential } = verification.registrationInfo;
  try {
    await supabaseWebauthnCredentialRepository.insert({
      profileId,
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? null,
    });
  } catch {
    return err("credential_save_failed");
  }

  return ok({ ok: true });
};

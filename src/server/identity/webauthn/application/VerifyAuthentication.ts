import "server-only";
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { getRedis } from "@/server/_shared/redis";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseWebauthnCredentialRepository } from "../infrastructure/repositories/SupabaseWebauthnCredentialRepository";
import { rpID, rpOrigin } from "../rpConfig";
import { authChallengeKey } from "./GenerateAuthenticationOptions";
import { mintSessionForProfile } from "./MintSessionForProfile";

export type VerifyAuthenticationInput = {
  attemptId: string;
  response: AuthenticationResponseJSON;
};

export type VerifyAuthenticationResult = { profileId: string };

export const verifyPasskeyAuthentication = async (
  input: VerifyAuthenticationInput,
): Promise<Result<VerifyAuthenticationResult>> => {
  const redis = getRedis();
  if (!redis) return err("webauthn_not_configured");

  const challenge = await redis.get<string>(authChallengeKey(input.attemptId));
  if (!challenge) return err("challenge_expired");
  await redis.del(authChallengeKey(input.attemptId));

  const stored = await supabaseWebauthnCredentialRepository.findByCredentialId(input.response.id);
  if (!stored) return err("credential_not_found");

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: challenge,
      expectedOrigin: rpOrigin(),
      expectedRPID: rpID(),
      credential: {
        id: stored.credentialId,
        publicKey: isoBase64URL.toBuffer(stored.publicKey),
        counter: stored.counter,
        transports: (stored.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
      },
    });
  } catch {
    return err("verification_failed");
  }
  if (!verification.verified) return err("verification_failed");

  await supabaseWebauthnCredentialRepository.updateCounter(
    stored.credentialId,
    verification.authenticationInfo.newCounter,
  );

  const db = supabaseAdmin();
  const { data: profile } = await db
    .from("profiles")
    .select("email")
    .eq("id", stored.profileId)
    .maybeSingle<{ email: string | null }>();
  if (!profile?.email) return err("profile_email_missing");

  const minted = await mintSessionForProfile(profile.email);
  if (!minted.ok) return minted;

  return ok({ profileId: stored.profileId });
};

import "server-only";
import { randomUUID } from "crypto";
import {
  generateAuthenticationOptions,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { getRedis } from "@/server/_shared/redis";
import { err, ok, type Result } from "@/server/_shared/result";
import { rpID } from "../rpConfig";

const CHALLENGE_TTL_SECONDS = 5 * 60;
export const authChallengeKey = (attemptId: string): string => `webauthn:auth-challenge:${attemptId}`;

export type AuthenticationOptionsResult = {
  options: PublicKeyCredentialRequestOptionsJSON;
  attemptId: string;
};

// Usernameless/discoverable: sin allowCredentials, el navegador ofrece las
// credenciales guardadas para este rpID sin que sepamos de antemano quién es.
export const generatePasskeyAuthenticationOptions = async (): Promise<
  Result<AuthenticationOptionsResult>
> => {
  const redis = getRedis();
  if (!redis) return err("webauthn_not_configured");

  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "required",
  });

  const attemptId = randomUUID();
  await redis.set(authChallengeKey(attemptId), options.challenge, { ex: CHALLENGE_TTL_SECONDS });

  return ok({ options, attemptId });
};

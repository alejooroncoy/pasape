import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

export const hashToken = (plaintext: string): string =>
  createHash("sha256").update(plaintext).digest("hex");

/** PKCE S256: code_challenge == base64url(sha256(code_verifier)). RFC 7636 §4.6. */
export const verifyPkce = (codeVerifier: string, codeChallenge: string): boolean =>
  createHash("sha256").update(codeVerifier).digest("base64url") === codeChallenge;

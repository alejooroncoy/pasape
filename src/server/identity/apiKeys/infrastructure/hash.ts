import "server-only";
import { createHash, randomBytes } from "node:crypto";

const PREFIX = "pk_live_";

/** Genera una key nueva en claro + su hash para persistir. El valor en claro
 *  se muestra una sola vez al organizador — no se puede recuperar después. */
export const generateApiKey = (): { plaintext: string; hash: string; prefix: string } => {
  const secret = randomBytes(24).toString("base64url");
  const plaintext = `${PREFIX}${secret}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, PREFIX.length + 6),
  };
};

export const hashApiKey = (plaintext: string): string =>
  createHash("sha256").update(plaintext).digest("hex");

export const looksLikeApiKey = (value: string): boolean => value.startsWith(PREFIX);

import "server-only";
import { createHash } from "node:crypto";

const PREFIX = "pk_live_";

export const hashApiKey = (plaintext: string): string =>
  createHash("sha256").update(plaintext).digest("hex");

export const looksLikeApiKey = (value: string): boolean => value.startsWith(PREFIX);

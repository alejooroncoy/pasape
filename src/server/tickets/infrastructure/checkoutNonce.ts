import "server-only";
import { Redis } from "@upstash/redis";

// Consumo single-use en Redis (SET NX atómico) para dos cosas del anti-bot:
//   - el CHALLENGE de proof-of-work: un challenge resuelto no se canjea 2 veces.
//   - el CHECKOUT-TOKEN en la fase de compra: un render → una orden.
//
// Fail-open: sin Redis o con Redis caído devolvemos "unknown" (se trata como
// fresh) — anti-bots nunca tumba ventas, igual que rateLimit.ts.

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash ? Redis.fromEnv() : null;

// TTL alineado a la vida útil del token/challenge (2 h): pasado eso ya no
// verifican, así que mantener el nonce más tiempo no aporta.
const NONCE_TTL_SECONDS = 2 * 60 * 60;

export type NonceOutcome = "fresh" | "replay" | "unknown";

/** Quema una clave de un solo uso. "replay" si ya existía. */
const consumeOnce = async (ns: string, key: string): Promise<NonceOutcome> => {
  if (!redis) return "unknown"; // dev local sin Redis
  try {
    const set = await redis.set(`${ns}:${key}`, 1, { nx: true, ex: NONCE_TTL_SECONDS });
    return set === "OK" ? "fresh" : "replay";
  } catch (e) {
    console.warn(`[antibot] fallo consumiendo nonce ${ns} (fail-open):`, e);
    return "unknown";
  }
};

/**
 * Quema el checkout-token en la fase de compra (una compra = un token). "replay"
 * si ya se usó — señal fuerte de automatización.
 */
export const consumeCheckoutToken = (token: string): Promise<NonceOutcome> =>
  consumeOnce("cxnonce", token);

/**
 * Quema el salt de un challenge de PoW al canjearlo. "replay" = intento de
 * reusar un challenge ya resuelto para mintar varios tokens.
 */
export const consumeChallenge = (salt: string): Promise<NonceOutcome> =>
  consumeOnce("cxchal", salt);

import { createHmac, timingSafeEqual } from "crypto";

// Token de coherencia de sesión del checkout. El server lo EMITE cuando el
// cliente monta la página de compra (GET /api/tickets/checkout-token) y el
// cliente lo reenvía en quote/buy. Sirve para dos señales anti-bot:
//
//   1. Coherencia: un bot que pega directo a /api/tickets/buy sin pasar por la
//      página no tiene token → checkout_token_ok=false (automatización directa).
//   2. Velocidad: el token EMBEBE el issuedAt firmado por el server, así el
//      backend mide ms_since_mount con SU reloj — el cliente no puede falsear
//      "tardé 12 s" para esconder una compra de 200 ms (carrera de scalper).
//
// HMAC-SHA256(secret, "checkout:"+eventId+":"+deviceHash+":"+issuedAt), mismo
// secret que los link tokens con prefijo de dominio propio. El deviceHash ATA el
// token al navegador que lo minteó (binding del P0 anti-automatización): un token
// minteado para un device solo compra desde ese device, así rotar identidad
// obliga a minar un challenge nuevo por cada una. Formato:
// "<issuedAt en base36>.<hmac 16 hex>".

const secret = (): string => {
  const s = process.env.TICKET_LINK_SECRET;
  if (!s) throw new Error("Missing env var: TICKET_LINK_SECRET");
  return s;
};

const SIG_HEX_LENGTH = 16; // 64 bits: infalsificable sin el secret (no anti-enum)

// Un token de hace horas casi seguro es replay de un script; el humano real
// compra dentro de una sesión. Holgado (2 h) para no cortar a quien deja la
// pestaña abierta y vuelve.
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Tolerancia de reloj hacia el futuro: issuedAt lo pone el server, así que un
// token "del futuro" solo aparece por skew de instancias; margen chico.
const FUTURE_SKEW_MS = 60_000;

const sig = (eventId: string, deviceHash: string, issuedAt: number): string =>
  createHmac("sha256", secret())
    .update(`checkout:${eventId}:${deviceHash}:${issuedAt}`)
    .digest("hex")
    .slice(0, SIG_HEX_LENGTH);

export const signCheckoutToken = (
  eventId: string,
  deviceHash: string,
  issuedAt: number = Date.now(),
): string => `${issuedAt.toString(36)}.${sig(eventId, deviceHash, issuedAt)}`;

export type CheckoutTokenCheck =
  | { ok: true; issuedAt: number; ageMs: number }
  | { ok: false };

/**
 * Verifica el token contra el eventId del pedido y devuelve la antigüedad
 * (ageMs = ms_since_mount) para el scorer. `ok:false` si falta, está mal
 * formado, la firma no cuadra, o cae fuera de la ventana temporal válida.
 */
export const verifyCheckoutToken = (
  eventId: string,
  deviceHash: string,
  token: string | null | undefined,
): CheckoutTokenCheck => {
  if (!token) return { ok: false };
  const [tsPart, sigPart] = token.split(".");
  if (!tsPart || !sigPart || sigPart.length !== SIG_HEX_LENGTH) return { ok: false };
  const issuedAt = parseInt(tsPart, 36);
  if (!Number.isFinite(issuedAt)) return { ok: false };

  const expected = sig(eventId, deviceHash, issuedAt);
  let valid = false;
  try {
    valid = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sigPart, "hex"));
  } catch {
    return { ok: false };
  }
  if (!valid) return { ok: false };

  const ageMs = Date.now() - issuedAt;
  if (ageMs < -FUTURE_SKEW_MS || ageMs > MAX_AGE_MS) return { ok: false };
  return { ok: true, issuedAt, ageMs };
};

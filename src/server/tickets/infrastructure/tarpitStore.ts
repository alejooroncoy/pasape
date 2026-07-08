import { getRedis } from "@/server/_shared/redis";

// Tarpit DIFERIDO (device/IP → peaje de latencia pendiente en Redis).
//
// El tarpit anti-bot no puede correr dentro de la función serverless de compra:
// un `await sleep` ahí mantiene viva la función (Vercel Fluid Compute) ocupando
// un slot de concurrencia — bajo un flood agota la capacidad y deja sin cupo al
// humano legítimo. Por eso el peaje se aplica en el PROXY (capa barata, antes de
// la función). Pero el proxy no tiene el score (se calcula en assessCheckout con
// el body + agregados de DB). Solución: el CheckoutGuard, tras puntuar, ARMA aquí
// el peaje para el device/IP; el proxy lo LEE y aplica el sleep en el SIGUIENTE
// request de esa entidad, antes de enrutar a /api/tickets/buy.
//
// Trade-off: el primer intento sospechoso no se ralentiza (su score recién se
// conoce dentro de la función); del segundo en adelante sí. Contra un bot que
// floodea (el caso que importa) cada intento paga el peaje en la capa barata y
// la función de compra nunca queda esperando. El humano (score < SOFT) nunca
// tiene peaje armado, así que jamás se ralentiza.
//
// Fail-open: sin Redis (dev) o con Redis caído no hay peaje — mismo espíritu que
// rateLimit.ts / checkoutNonce.ts: el anti-bot nunca tumba ventas.

const TARPIT_MAX_MS = 8_000; // techo alineado con botEnforcement.tarpitDelayMs
const clampDelay = (n: number): number => Math.max(0, Math.min(TARPIT_MAX_MS, Math.round(n)));

const keysFor = (deviceHash: string | null, ip: string | null): string[] =>
  [deviceHash ? `tarpit:dev:${deviceHash}` : null, ip ? `tarpit:ip:${ip}` : null].filter(
    (k): k is string => !!k,
  );

/**
 * Arma el peaje de tarpit para device/IP. No bloqueante para el caller (se llama
 * fire-and-forget desde el guard). TTL corto = duración del delay + margen para
 * atrapar el siguiente intento del flood; se auto-limpia solo cuando el device
 * deja de verse sospechoso (el guard deja de re-armarlo).
 */
export const armTarpit = async (
  deviceHash: string | null,
  ip: string | null,
  delayMs: number,
): Promise<void> => {
  const redis = getRedis();
  const delay = clampDelay(delayMs);
  if (!redis || delay <= 0) return;
  const keys = keysFor(deviceHash, ip);
  if (!keys.length) return;
  const ttl = Math.ceil(delay / 1000) + 3;
  try {
    await Promise.all(keys.map((k) => redis.set(k, delay, { ex: ttl })));
  } catch (e) {
    console.warn("[antibot] fallo armando tarpit (fail-open):", e);
  }
};

/**
 * Lee el peaje de tarpit pendiente para device/IP (0 si no hay). NO lo borra: el
 * TTL corto lo limpia y el guard lo re-arma mientras el device siga malo, así
 * cada request del flood dentro de la ventana paga. Toma el máximo entre device
 * e IP. Fail-open a 0.
 */
export const pendingTarpitMs = async (
  deviceHash: string | null,
  ip: string | null,
): Promise<number> => {
  const redis = getRedis();
  if (!redis) return 0;
  const keys = keysFor(deviceHash, ip);
  if (!keys.length) return 0;
  try {
    const vals = await Promise.all(keys.map((k) => redis.get<number>(k)));
    const max = vals.reduce<number>((m, v) => (typeof v === "number" && v > m ? v : m), 0);
    return clampDelay(max);
  } catch (e) {
    console.warn("[antibot] fallo leyendo tarpit (fail-open):", e);
    return 0;
  }
};

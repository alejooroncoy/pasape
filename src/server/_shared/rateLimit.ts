import { NextResponse, type NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limit por IP con ventana deslizante.
//
// Backend: Upstash Redis (distribuido) cuando UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN están seteados; si no, cae a un limitador in-memory
// (dev local sin Redis). El in-memory NO sirve en serverless multi-instancia —
// por eso producción DEBE tener las env de Upstash.

const ipOf = (req: NextRequest): string =>
  // `x-real-ip` lo fija la plataforma (Vercel) con la IP real de conexión y el
  // cliente no puede sobrescribirlo — preferirlo cierra el spoof trivial en que
  // un atacante manda `X-Forwarded-For: <ip-aleatoria>` para obtener un bucket
  // nuevo por request. El primer valor de XFF SÍ es inyectable, por eso queda
  // solo como fallback para entornos sin x-real-ip.
  req.headers.get("x-real-ip")?.trim() ??
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";

export type RateLimiter = {
  /** true si la request puede continuar; false si se debe responder 429. */
  check: (req: NextRequest) => Promise<boolean>;
  /** Respuesta estándar 429 lista para retornar. */
  response: () => NextResponse;
};

const rateLimitedResponse = (): NextResponse =>
  NextResponse.json({ error: "rate_limited" }, { status: 429 });

// ── Backend Redis (Upstash) ─────────────────────────────────────────────────
// Singleton a nivel de módulo (fuera de los handlers) para reusar conexión y el
// ephemeralCache entre invocaciones.
const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasUpstash ? Redis.fromEnv() : null;

// Cache en memoria compartido: corta con un id ya bloqueado sin ir a Redis. Sus
// claves ya llevan el prefix de cada limiter, así que compartir un solo Map es
// seguro entre endpoints.
const ephemeralCache = new Map<string, number>();

let warnedNoRedis = false;

// ── Backend in-memory (fallback dev) ────────────────────────────────────────
type Bucket = { count: number; resetAt: number };

const createInMemoryLimiter = (maxPerWindow: number, windowMs: number): RateLimiter => {
  const buckets = new Map<string, Bucket>();
  const consume = (ip: string): boolean => {
    const now = Date.now();
    const b = buckets.get(ip);
    if (!b || now > b.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (b.count >= maxPerWindow) return false;
    b.count += 1;
    return true;
  };
  return {
    check: async (req) => consume(ipOf(req)),
    response: rateLimitedResponse,
  };
};

/**
 * Crea un limitador identificado por IP con ventana deslizante.
 *
 * @param name         identificador único del endpoint (aísla el bucket en Redis;
 *                     dos endpoints con el mismo `name` compartirían contador)
 * @param maxPerWindow máximo de requests permitidas por ventana
 * @param windowMs     duración de la ventana en ms (default 60s)
 */
export const createRateLimiter = (
  name: string,
  maxPerWindow: number,
  windowMs = 60_000,
): RateLimiter => {
  if (!redis) {
    if (!warnedNoRedis && process.env.NODE_ENV === "production") {
      warnedNoRedis = true;

      console.warn(
        "[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN no configurados: usando limitador in-memory (inseguro en serverless multi-instancia).",
      );
    }
    return createInMemoryLimiter(maxPerWindow, windowMs);
  }

  const seconds = Math.max(1, Math.round(windowMs / 1000));
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxPerWindow, `${seconds} s`),
    ephemeralCache,
    prefix: `rl:${name}`,
    // Fail-open si Redis está lento/inalcanzable: preferimos disponibilidad a
    // bloquear tráfico legítimo (el límite es defensa anti-abuso, no un gate).
    timeout: 2000,
  });

  return {
    check: async (req) => {
      const { success } = await ratelimit.limit(ipOf(req));
      return success;
    },
    response: rateLimitedResponse,
  };
};

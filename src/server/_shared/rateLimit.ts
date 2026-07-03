import { NextResponse, type NextRequest } from "next/server";

// Rate limit in-memory por IP, ventana fija. Mismo patrón que
// identity/dni-lookup y newsletter — suficiente para mitigar abuso casual
// en un solo proceso/región; si el tráfico crece se sustituye por edge/redis.
type Bucket = { count: number; resetAt: number };

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
  check: (req: NextRequest) => boolean;
  /** Respuesta estándar 429 lista para retornar. */
  response: () => NextResponse;
};

/**
 * Crea un limitador in-memory identificado por IP.
 *
 * @param maxPerWindow máximo de requests permitidas por ventana
 * @param windowMs duración de la ventana en ms (default 60s)
 */
export const createRateLimiter = (maxPerWindow: number, windowMs = 60_000): RateLimiter => {
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
    check: (req) => consume(ipOf(req)),
    response: () => NextResponse.json({ error: "rate_limited" }, { status: 429 }),
  };
};

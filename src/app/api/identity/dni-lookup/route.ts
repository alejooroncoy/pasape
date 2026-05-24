import type { NextRequest } from "next/server";
import { z } from "zod";
import { buildFullName, lookupDni } from "@/server/identity/infrastructure/DecolectaClient";
import { fail, ok as okJson } from "@/server/_shared/http";

const dniSchema = z.object({ dni: z.string().regex(/^\d{8}$/, "invalid_dni") });

// Rate limit in-memory: 10 req/min por IP. Suficiente para mitigar abuso casual;
// en producción real se sustituye por edge/redis si crece tráfico.
type Bucket = { count: number; resetAt: number };
const BUCKETS = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

const consumeRate = (ip: string): boolean => {
  const now = Date.now();
  const b = BUCKETS.get(ip);
  if (!b || now > b.resetAt) {
    BUCKETS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_PER_WINDOW) return false;
  b.count += 1;
  return true;
};

const ipOf = (req: NextRequest): string => {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
};

export const GET = async (req: NextRequest) => {
  const ip = ipOf(req);
  if (!consumeRate(ip)) return fail("rate_limited", 429);

  const url = new URL(req.url);
  const parsed = dniSchema.safeParse({ dni: url.searchParams.get("dni") ?? "" });
  if (!parsed.success) return fail("invalid_dni", 400);

  const res = await lookupDni(parsed.data.dni);
  if (!res.ok) {
    const status =
      res.error === "decolecta_not_configured"
        ? 503
        : res.error === "dni_not_found"
          ? 404
          : 502;
    return fail(res.error, status);
  }
  return okJson({ fullName: buildFullName(res.value) });
};

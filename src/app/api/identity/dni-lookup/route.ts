import type { NextRequest } from "next/server";
import { z } from "zod";
import { buildFullName, lookupDni } from "@/server/identity/infrastructure/DecolectaClient";
import { fail, ok as okJson } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";

const dniSchema = z.object({ dni: z.string().regex(/^\d{8}$/, "invalid_dni") });

// LOW-9: el limiter in-memory anterior era por-instancia — en serverless
// (múltiples lambdas) el límite efectivo real era mucho mayor al nominal.
// createRateLimiter usa Upstash Redis (distribuido) cuando está configurado,
// igual que /api/scanning/* y /api/payments/retry.
const limiter = createRateLimiter("identity:dni-lookup", 10);

export const GET = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return fail("rate_limited", 429);

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

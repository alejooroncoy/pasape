import type { NextRequest } from "next/server";
import { z } from "zod";
import { buildFullName, lookupDni } from "@/server/identity/infrastructure/DecolectaClient";
import { fail, ok as okJson } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";

const dniSchema = z.object({ dni: z.string().regex(/^\d{8}$/, "invalid_dni") });

// Consulta RENIEC (vía Decolecta) sin sesión: es pública por diseño (checkout de
// invitado, onboarding, join de box). El rate limit vive en Upstash Redis
// (compartido entre instancias serverless) igual que los demás endpoints
// sensibles — un Map in-memory por-instancia no sirve en Vercel multi-instancia.
const DNI_LOOKUP_MAX_PER_MINUTE = 10;
const rateLimiter = createRateLimiter("identity:dni-lookup", DNI_LOOKUP_MAX_PER_MINUTE);

export const GET = async (req: NextRequest) => {
  if (!(await rateLimiter.check(req))) return rateLimiter.response();

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

import { z } from "zod";
import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { err } from "@/server/_shared/result";
import { prepareRetry } from "@/server/payments/application/RetryPayment";
import { createRateLimiter } from "@/server/_shared/rateLimit";
import { getAuthContext } from "@/server/_shared/AuthContext";

const schema = z.object({
  orderId: z.string().uuid(),
  // Prueba de posesión para invitados sin sesión (LOW-1/LOW-6): el mismo email
  // con el que se hizo la compra.
  guestEmail: z.string().email().optional(),
});

// 10 req/min por IP: el comprador reintenta con otro medio cuando su pago quedó
// en revisión. Cancela el pago anterior en MP antes de cobrar el nuevo.
const limiter = createRateLimiter("payments:retry", 10);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(err(parsed.error.issues[0]?.message ?? "invalid_input"));
  }
  const auth = await getAuthContext();
  const res = await prepareRetry(parsed.data.orderId, {
    profileId: auth.ok ? auth.value.profileId : null,
    guestEmail: parsed.data.guestEmail?.toLowerCase() ?? null,
  });
  return json(res);
};

import { z } from "zod";
import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { err } from "@/server/_shared/result";
import { prepareRetry } from "@/server/payments/application/RetryPayment";
import { createRateLimiter } from "@/server/_shared/rateLimit";

const schema = z.object({
  orderId: z.string().uuid(),
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
  const res = await prepareRetry(parsed.data.orderId);
  return json(res);
};

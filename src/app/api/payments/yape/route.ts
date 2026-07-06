import { z } from "zod";
import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { err } from "@/server/_shared/result";
import { payWithYape } from "@/server/payments/application/PayWithYape";
import { createRateLimiter } from "@/server/_shared/rateLimit";

const schema = z.object({
  orderId: z.string().uuid(),
  token: z.string().min(8).max(200),
  phoneNumber: z.string().regex(/^\d{9}$/),
  deviceId: z.string().max(1000).nullable().optional(),
  orderToken: z.string().min(8).max(200).nullable().optional(),
});

// 10 req/min por IP: intentos de pago con Yape el día del evento.
const limiter = createRateLimiter("payments:yape", 10);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(err(parsed.error.issues[0]?.message ?? "invalid_input"));
  }
  const res = await payWithYape(parsed.data);
  return json(res);
};

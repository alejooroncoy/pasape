import { z } from "zod";
import type { NextRequest } from "next/server";
import { json } from "@/server/_shared/http";
import { err } from "@/server/_shared/result";
import { payWithCard } from "@/server/payments/application/PayWithCard";
import { createRateLimiter } from "@/server/_shared/rateLimit";
import { getOrderBuyerId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

const schema = z.object({
  orderId: z.string().uuid(),
  token: z.string().min(8).max(200),
  paymentMethodId: z.string().min(2).max(40),
  installments: z.number().int().min(1).max(36),
  issuerId: z.string().nullable().optional(),
  // Device fingerprint (window.MP_DEVICE_SESSION_ID). Opcional: si el SDK no lo
  // pobló, el pago igual procede (solo baja un poco el approval rate). OJO: los
  // fingerprints reales de MP (prefijo "armor.") pasan holgados los 200 chars —
  // rondan 250–400 — así que el tope va en 1000 para no rechazarlos.
  deviceId: z.string().max(1000).nullable().optional(),
  orderToken: z.string().min(8).max(200).nullable().optional(),
});

// 10 req/min por IP: intentos de pago con tarjeta el día del evento.
const limiter = createRateLimiter("payments:card", 10);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(err(parsed.error.issues[0]?.message ?? "invalid_input"));
  }
  const res = await payWithCard(parsed.data);
  if (res.ok) {
    const distinctId = (await getOrderBuyerId(parsed.data.orderId)) ?? "anonymous";
    serverEvents.paymentCardInitiated(distinctId, { order_id: parsed.data.orderId });
    // Rechazo síncrono de MP: no siempre llega webhook aparte para esto, así que
    // lo capturamos acá también (el webhook cubre el caso async/in_process).
    if (res.value.status === "rejected") {
      serverEvents.paymentFailed(distinctId, { order_id: parsed.data.orderId, method: "card" });
    }
  }
  return json(res);
};

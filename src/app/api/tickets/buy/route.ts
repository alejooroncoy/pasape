import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";
import { serverEvents } from "@/lib/analytics/serverEvents";

// 10 req/min por IP: tráfico de compra alto el día del evento, pero conservador
// para no bloquear compras legítimas (reintentos, checkout con varios pasos).
const limiter = createRateLimiter("tickets:buy", 10);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  const result = await TicketsController.buy(body);
  if (result.ok) {
    const distinctId = result.value?.order?.buyerId ?? "anonymous";
    serverEvents.orderCreated(distinctId, {
      order_id: result.value?.order?.id,
      event_id: body.eventId,
      items_count: Array.isArray(body.items) ? body.items.length : 0,
      total_cents: result.value?.order?.totalCents,
      currency: result.value?.order?.currency,
      has_promo: !!body.promoCode,
    });
  }
  return json(result, 201);
};

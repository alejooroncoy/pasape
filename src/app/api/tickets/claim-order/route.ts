import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";
import { getAuthDistinctId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

// 10 req/min por IP: evita polling/abuso agresivo del reclamo de orden.
const limiter = createRateLimiter("tickets:claim-order", 10);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  const result = await TicketsController.claimOrder(body);
  if (result.ok) {
    serverEvents.orderClaimed(await getAuthDistinctId(), {
      order_id: body.orderId,
      tickets_claimed: result.value.ticketsClaimed,
      event_slug: result.value.eventSlug,
    });
  }
  return json(result);
};

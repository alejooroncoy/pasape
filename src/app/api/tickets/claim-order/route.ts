import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";

// 10 req/min por IP: evita polling/abuso agresivo del reclamo de orden.
const limiter = createRateLimiter("tickets:claim-order", 10);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  return json(await TicketsController.claimOrder(body));
};

import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";

// Más generoso que /buy: se dispara en cada transición de paso del checkout
// (y es read-only, no reserva stock).
const limiter = createRateLimiter("tickets:quote", 30);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  return json(await TicketsController.quote(body));
};

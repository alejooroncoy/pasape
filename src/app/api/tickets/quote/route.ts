import type { NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";
import { assessCheckout } from "@/server/tickets/application/CheckoutGuard";
import { purchaseSignalFields } from "@/server/tickets/application/purchaseSignalFields";

// Más generoso que /buy: se dispara en cada transición de paso del checkout
// (y es read-only, no reserva stock).
const limiter = createRateLimiter("tickets:quote", 30);

export const POST = async (req: NextRequest) => {
  const startedAt = performance.now();
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));
  // Solo REGISTRA la señal (velocidad + historial de device que luego alimenta el
  // score de /buy). No se bloquea ni se puntúa el quote: es read-only e inofensivo.
  await assessCheckout({ req, phase: "quote", assess: false, ...purchaseSignalFields(body) });
  const response = json(await TicketsController.quote(body));
  response.headers.set("Server-Timing", `quote;dur=${(performance.now() - startedAt).toFixed(1)}`);
  return response;
};

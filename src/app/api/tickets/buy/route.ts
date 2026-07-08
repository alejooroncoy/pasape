import { NextResponse, type NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";
import { serverEvents } from "@/lib/analytics/serverEvents";
import { assessCheckout } from "@/server/tickets/application/CheckoutGuard";
import { purchaseSignalFields } from "@/server/tickets/application/purchaseSignalFields";
import { purchaseSignalsRepo } from "@/server/tickets/infrastructure/PurchaseSignalsRepo";

// 10 req/min por IP: tráfico de compra alto el día del evento, pero conservador
// para no bloquear compras legítimas (reintentos, checkout con varios pasos).
const limiter = createRateLimiter("tickets:buy", 10);

export const POST = async (req: NextRequest) => {
  if (!(await limiter.check(req))) return limiter.response();
  const body = await req.json().catch(() => ({}));

  // Anti-bot por comportamiento: puntúa el intento y decide según BOT_ENFORCEMENT.
  // En shadow (default) siempre permite; solo registra. El bloqueo se enmascara
  // como 429 genérico; el tarpit ralentiza al sospechoso sin revelar la detección.
  const assessment = await assessCheckout({ req, phase: "buy", ...purchaseSignalFields(body) });
  if (!assessment.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  // Tarpit: al device sospechoso se le inyecta latencia creciente antes de
  // procesar. Mata la economía de la compra masiva sin bloquear al humano.
  if (assessment.delayMs > 0) await new Promise((r) => setTimeout(r, assessment.delayMs));

  const result = await TicketsController.buy(body);
  if (result.ok) {
    const orderId = result.value?.order?.id;
    // Enlaza la señal anti-bot con la orden recién creada, para correlacionar
    // luego los rechazos de pago (carding) con el device/ip real del comprador.
    if (orderId && assessment.signalId) {
      void purchaseSignalsRepo.attachOrder(assessment.signalId, orderId);
    }
    const distinctId = result.value?.order?.buyerId ?? "anonymous";
    serverEvents.orderCreated(distinctId, {
      order_id: orderId,
      event_id: body.eventId,
      items_count: Array.isArray(body.items) ? body.items.length : 0,
      total_cents: result.value?.order?.totalCents,
      currency: result.value?.order?.currency,
      has_promo: !!body.promoCode,
    });
  }
  return json(result, 201);
};

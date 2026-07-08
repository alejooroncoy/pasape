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
  // Step-up challenge: el intento cae en zona sospechosa y aún no adjuntó una
  // solución válida. Respondemos 428 con un PoW (dificultad escalada por el score);
  // el cliente lo resuelve en background (invisible al humano) y reintenta con la
  // solución en x-cx-stepup. El bot masivo paga este peaje por cada intento.
  if (assessment.challengeRequired && assessment.challenge) {
    return NextResponse.json(
      { error: "challenge_required", challenge: assessment.challenge },
      { status: 428 },
    );
  }
  // Tarpit heredado (hoy delayMs siempre 0: el step-up lo reemplaza). Se conserva
  // por si una futura política vuelve a inyectar latencia.
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

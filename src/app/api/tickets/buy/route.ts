import { NextResponse, type NextRequest } from "next/server";
import { TicketsController } from "@/server/tickets/controllers/rest/TicketsController";
import { json } from "@/server/_shared/http";
import { createRateLimiter } from "@/server/_shared/rateLimit";
import { serverEvents } from "@/lib/analytics/serverEvents";
import { assessCheckout } from "@/server/tickets/application/CheckoutGuard";
import { purchaseSignalFields } from "@/server/tickets/application/purchaseSignalFields";
import { purchaseSignalsRepo } from "@/server/tickets/infrastructure/PurchaseSignalsRepo";
import { isAuthorizedLoadTest } from "@/server/tickets/application/LoadTestMode";

// 10 req/min por IP: tráfico de compra alto el día del evento, pero conservador
// para no bloquear compras legítimas (reintentos, checkout con varios pasos).
const limiter = createRateLimiter("tickets:buy", 10);
const authorizedLoadTestAssessment = {
  allowed: true,
  action: "logged" as const,
  score: 0,
  reasons: [],
  delayMs: 0,
  signalId: null,
  challengeRequired: false,
  challenge: null,
};

export const POST = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const fields = purchaseSignalFields(body);
  const isLoadTest = isAuthorizedLoadTest(req, fields.eventId);

  // Un load test firmado simula compradores independientes desde una sola
  // salida. El endpoint público jamás entra aquí sin flag+secreto+allow-list.
  if (!isLoadTest && !(await limiter.check(req))) return limiter.response();

  // Anti-bot por comportamiento: puntúa el intento y decide según BOT_ENFORCEMENT.
  // En shadow (default) siempre permite; solo registra. El bloqueo se enmascara
  // como 429 genérico; el tarpit ralentiza al sospechoso sin revelar la detección.
  // stockRemaining alimenta bulk_stock_grab (vaciar stock de golpe) — sin esto la
  // señal nunca dispara en producción.
  // Un ensayo autorizado no debe contaminar las señales que protegen compras
  // reales. No basta assess:false: ese modo igual persiste la señal cruda.
  const assessment = isLoadTest
    ? authorizedLoadTestAssessment
    : await assessCheckout({
        req,
        phase: "buy",
        ...fields,
        stockRemaining: await purchaseSignalsRepo.minStockRemaining(fields.ticketTypeIds),
      });
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
  // Tarpit: NO se duerme aquí. El step-up challenge ya cubre toda la zona
  // sospechosa (decideEnforcement no vuelve a emitir delayMs>0 en ese camino),
  // así que este bloque es hoy inerte; se deja como capa de respaldo (armada vía
  // Redis en assessCheckout y leída por el proxy) por si una futura política
  // reintroduce delay puro. Ver tarpitStore.ts y src/proxy.ts.

  const result = await TicketsController.buy(body, { suppressWhatsAppDelivery: isLoadTest });
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

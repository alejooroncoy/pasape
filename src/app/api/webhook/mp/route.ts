import { NextResponse, type NextRequest } from "next/server";
import { handleMpWebhook } from "@/server/payments/application/HandleWebhook";
import { getOrderBuyerId } from "@/lib/posthog-server";
import { serverEvents } from "@/lib/analytics/serverEvents";

// Why: MP reintenta si no recibe 2xx en pocos segundos. Mantenemos la
// respuesta liviana: si algo falla downstream (Supabase, fetch del payment),
// devolvemos 500 para que MP reintente; si solo es payload desconocido, 200.
export const POST = async (req: NextRequest) => {
  const rawBody = await req.text();
  const url = new URL(req.url);
  const result = await handleMpWebhook({
    rawBody,
    query: url.searchParams,
    headers: {
      signature: req.headers.get("x-signature"),
      requestId: req.headers.get("x-request-id"),
    },
  });
  if (!result.ok) {

    console.error("[mp-webhook]", result.error);
    // 401 cuando la firma es inválida — no queremos que MP reintente fake calls.
    const status = result.error === "invalid_signature" ? 401 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  if (result.value?.orderId && (result.value.mapped === "paid" || result.value.mapped === "failed")) {
    const distinctId = (await getOrderBuyerId(result.value.orderId)) ?? result.value.orderId;
    if (result.value.mapped === "paid") {
      serverEvents.paymentCompleted(distinctId, { order_id: result.value.orderId });
    } else {
      serverEvents.paymentFailed(distinctId, {
        order_id: result.value.orderId,
        method: "mp_webhook",
        mp_status: result.value.status,
      });
    }
  }
  return NextResponse.json({ ok: true });
};

export const GET = async () => NextResponse.json({ ok: true });

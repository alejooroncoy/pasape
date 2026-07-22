import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { WhatsAppSalesWebhookController } from "@/server/promoters/whatsappSales/controllers/rest/WhatsAppSalesWebhookController";

// Recibe mensajes entrantes de WhatsApp (vía Kapso, modo "Meta forward raw
// webhook") para el bot de venta por promotores
// (docs/mvp-whatsapp-promotores-2026-07-21.md). KAPSO_WEBHOOK_SECRET vive en
// las env vars del proyecto en Vercel.

// Verificación de firma: Kapso firma el body crudo con HMAC-SHA256 usando el
// signing secret configurado en su dashboard (header X-Webhook-Signature).
// Sin esto, cualquiera que adivine esta URL podría inyectar mensajes falsos
// (ej. "pagado <código>" suplantando a un promotor).
//
// Formato exacto NO confirmado con la documentación de Kapso todavía — se
// asume el estándar de la industria (hex de HMAC-SHA256 del body crudo,
// opcionalmente prefijado "sha256="). Si los webhooks reales llegan
// rechazados por firma inválida, este es el primer lugar a revisar.
const isValidSignature = (rawBody: string, signatureHeader: string | null, secret: string): boolean => {
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(received, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
};

export const POST = async (req: NextRequest) => {
  const rawBody = await req.text();

  const secret = process.env.KAPSO_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers.get("x-webhook-signature");
    if (!isValidSignature(rawBody, signature, secret)) {
      console.error("[kapso-webhook] invalid signature");
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
  } else {
    // Sin KAPSO_WEBHOOK_SECRET configurado, no hay nada que validar — se
    // acepta sin firma. Aceptable solo mientras se prueba en un promotor de
    // prueba controlado (ver docs del MVP); no dejar así en uso real.
    console.warn("[kapso-webhook] KAPSO_WEBHOOK_SECRET no configurado — aceptando sin verificar firma");
  }

  const payload = JSON.parse(rawBody || "null");
  if (!payload) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  try {
    await WhatsAppSalesWebhookController.handleInbound(payload);
  } catch (e) {
    console.error("[kapso-webhook]", (e as Error).message);
    // 200 igual: no queremos que Kapso reintente indefinidamente un mensaje
    // que ya procesamos parcialmente (ej. venta creada pero el segundo
    // sendText falló) — el error queda en logs para revisión manual.
  }
  return NextResponse.json({ ok: true });
};

// Muchos proveedores (incluido Meta Cloud API) hacen un GET de verificación
// del webhook al configurarlo (challenge/verify_token). Confirmar si Kapso
// también lo requiere; placeholder simple mientras tanto.
export const GET = async (req: NextRequest) => {
  const url = new URL(req.url);
  const challenge = url.searchParams.get("hub.challenge");
  if (challenge) return new NextResponse(challenge);
  return NextResponse.json({ ok: true });
};

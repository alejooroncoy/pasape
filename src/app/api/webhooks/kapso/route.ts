import { NextResponse, type NextRequest } from "next/server";
import { WhatsAppSalesWebhookController } from "@/server/promoters/whatsappSales/controllers/rest/WhatsAppSalesWebhookController";

// Recibe mensajes entrantes de WhatsApp (vía Kapso) para el bot de venta por
// promotores (docs/mvp-whatsapp-promotores-2026-07-21.md).
//
// TODO bloqueante antes de producción real: verificar firma del webhook.
// Kapso/Meta firman el body — sin validarla, cualquiera que adivine esta URL
// podría inyectar mensajes falsos (ej. "pagado <código>" suplantando a un
// promotor). No implementado todavía porque no se confirmó el mecanismo
// exacto de Kapso (header, secreto) — confirmar con su documentación antes de
// exponer esta ruta fuera de pruebas.
export const POST = async (req: NextRequest) => {
  const payload = await req.json().catch(() => null);
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

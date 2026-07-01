import "server-only";
import crypto from "node:crypto";
import { Payment } from "mercadopago";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseCommissionTierRepository } from "@/server/promoters/tiers/infrastructure/repositories/SupabaseCommissionTierRepository";
import { dispatchTicketDelivery } from "@/server/notifications/application/DispatchTicketDelivery";
import { supabaseBoxRepository } from "@/server/boxes/infrastructure/repositories/SupabaseBoxRepository";
import { mpClient, mpWebhookSecret } from "../infrastructure/MercadoPagoClient";

export type WebhookHeaders = {
  signature: string | null;
  requestId: string | null;
};

export type WebhookInput = {
  rawBody: string;
  query: URLSearchParams;
  headers: WebhookHeaders;
};

// Why: MP firma `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con HMAC-SHA256
// usando el secret configurado en el panel. El header `x-signature` viene como
// `ts=...,v1=...`.
const verifySignature = (params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean => {
  const { signatureHeader, requestId, dataId, secret } = params;
  if (!signatureHeader || !requestId || !dataId) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  // Constant-time compare
  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
};

type MpPaymentStatus =
  | "approved"
  | "rejected"
  | "cancelled"
  | "in_process"
  | "pending"
  | "refunded"
  | "charged_back"
  | string;

const mapOrderStatus = (
  s: MpPaymentStatus,
): "paid" | "failed" | "pending" | "refunded" | null => {
  if (s === "approved") return "paid";
  if (s === "rejected" || s === "cancelled") return "failed";
  if (s === "in_process" || s === "pending") return "pending";
  // refunded/charged_back: estado terminal — anula tickets y excluye del rollup.
  if (s === "refunded" || s === "charged_back") return "refunded";
  return null;
};

export const handleMpWebhook = async (
  input: WebhookInput,
): Promise<Result<{ orderId?: string; status?: string }>> => {
  // MP sends `type` and `data.id` either via query or JSON body, depending on topic.
  let parsed: { type?: string; topic?: string; data?: { id?: string }; id?: string } = {};
  try {
    parsed = input.rawBody ? JSON.parse(input.rawBody) : {};
  } catch {
    parsed = {};
  }

  const type = parsed.type ?? parsed.topic ?? input.query.get("type") ?? input.query.get("topic");
  const dataId =
    parsed.data?.id ?? input.query.get("data.id") ?? input.query.get("id") ?? null;

  if (!type || !dataId) return ok({}); // ignore unknown payloads silently

  // We only handle payment topics for now.
  if (type !== "payment" && type !== "payment.created" && type !== "payment.updated") {
    return ok({});
  }

  // Verify signature (skip in non-production if secret missing, log-only).
  try {
    const secret = mpWebhookSecret();
    const okSig = verifySignature({
      signatureHeader: input.headers.signature,
      requestId: input.headers.requestId,
      dataId,
      secret,
    });
    if (!okSig) return err("invalid_signature");
  } catch {
    if (process.env.NODE_ENV === "production") return err("missing_mp_webhook_secret");
     
    console.warn("[mp-webhook] MP_WEBHOOK_SECRET not set — skipping signature verification (dev only)");
  }

  const db = supabaseAdmin();
  const dedupeKey = `payment-${dataId}-${input.headers.requestId ?? "noreq"}`;

  // Idempotency insert. If duplicate, return ok early.
  const { error: dupErr } = await db
    .from("mp_webhook_events")
    .insert({ mp_id: dedupeKey, payload: parsed });
  if (dupErr) {
    // PK violation → already processed.
    if (dupErr.code === "23505" || /duplicate key/i.test(dupErr.message)) {
      return ok({});
    }
    // Other errors: continue but log.
     
    console.warn("[mp-webhook] dedupe insert failed:", dupErr.message);
  }

  // Fetch payment details from MP.
  let payment: { status?: string; external_reference?: string | null } = {};
  try {
    const config = mpClient();
    const client = new Payment(config);
    const fetched = await client.get({ id: dataId });
    payment = { status: fetched.status, external_reference: fetched.external_reference };
  } catch (e) {
    return err(`mp_payment_fetch_failed: ${(e as Error).message}`);
  }

  const orderId = payment.external_reference;
  if (!orderId) return ok({}); // nothing to update

  const status = payment.status ?? "unknown";
  const mapped = mapOrderStatus(status);

  // Always snapshot mp_status + mp_payment_id.
  const update: Record<string, unknown> = {
    mp_status: status,
    mp_payment_id: dataId,
    updated_at: new Date().toISOString(),
  };
  if (mapped === "paid") {
    update.status = "paid";
    update.paid_at = new Date().toISOString();
  } else if (mapped === "failed") {
    update.status = "failed";
  } else if (mapped === "refunded") {
    // Reembolso/contracargo: estado terminal. Cambiar status (no solo mp_status)
    // hace que el trigger AFTER UPDATE OF status emita el broadcast y que el
    // rollup (filtra status='paid') deje de contar esta orden.
    update.status = "refunded";
  }

  const { data: orderRow, error: upErr } = await db
    .from("orders")
    .update(update)
    .eq("id", orderId)
    .select("id, status, promoter_link_id")
    .maybeSingle<{ id: string; status: string; promoter_link_id: string | null }>();
  if (upErr) return err(`order_update_failed: ${upErr.message}`);

  // Despacho del QR por email + WhatsApp al comprador (guest o logueado).
  // Fire-and-forget para no bloquear el ack del webhook; los errores quedan
  // registrados en `notification_dispatches`.
  if (mapped === "paid" && orderRow) {
    void dispatchTicketDelivery({ db }, orderRow.id).catch((e) => {

      console.error("[mp-webhook] dispatchTicketDelivery failed:", (e as Error).message);
    });
    // Un box es una compra: su grupo nace al confirmarse el pago, no al abrir el
    // wallet. Idempotente; fire-and-forget para no bloquear el ack del webhook.
    void supabaseBoxRepository.ensureForOrder(orderRow.id).catch((e) => {

      console.error("[mp-webhook] ensureForOrder failed:", (e as Error).message);
    });
  }

  // Recalcular hitos de comisión si la venta vía promotor quedó aprobada.
  if (mapped === "paid" && orderRow?.promoter_link_id) {
    const { count: paidCount } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("promoter_link_id", orderRow.promoter_link_id)
      .eq("status", "paid");
    await supabaseCommissionTierRepository.recalcUnlocksForLink(
      orderRow.promoter_link_id,
      paidCount ?? 0,
    );
  }

  // Compensación si el pago falla o se reembolsa: anular tickets (inválidos en
  // puerta) y devolver capacity. Sin esto, una entrada reembolsada seguiría
  // escaneando como válida.
  if ((mapped === "failed" || mapped === "refunded") && orderRow) {
    // Anular tickets (no los ya usados) libera el stock. ticket_types.sold lo
    // recalcula el trigger tickets_sync_sold a partir de los tickets reales.
    await db
      .from("tickets")
      .update({ status: "void" })
      .eq("order_id", orderRow.id)
      .neq("status", "used");
  }

  // Audit trail in the canonical `payments` table. Idempotency is handled
  // by mp_webhook_events above; we still insert a row per webhook for history.
  await db.from("payments").insert({
    order_id: orderId,
    provider: "mercadopago",
    provider_ref: dataId,
    status: mapped ?? "pending",
    amount_cents: 0,
    raw: parsed as object,
  });

  return ok({ orderId, status });
};

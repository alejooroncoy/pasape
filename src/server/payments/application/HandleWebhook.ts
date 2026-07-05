import "server-only";
import crypto from "node:crypto";
import { Payment } from "mercadopago";
import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseCommissionTierRepository } from "@/server/promoters/tiers/infrastructure/repositories/SupabaseCommissionTierRepository";
import { dispatchTicketDelivery } from "@/server/notifications/application/DispatchTicketDelivery";
import { supabaseBoxRepository } from "@/server/boxes/infrastructure/repositories/SupabaseBoxRepository";
import { mpClient, mpWebhookSecret, refundMpPayment } from "../infrastructure/MercadoPagoClient";
import { Money } from "@/lib/_shared/money";

// Why: en prod, si MP_ACCESS_TOKEN no arranca con "APP_USR-" (o sea, parece
// ser de sandbox tipo "TEST-...") estaríamos validando pagos reales contra
// credenciales de prueba. Es un error silencioso y carísimo si nadie lo
// nota, así que lo dejamos imposible de ignorar en los logs al primer
// request (sin crashear la app).
let mpTokenChecked = false;
const assertProductionMpToken = (): void => {
  if (mpTokenChecked) return;
  mpTokenChecked = true;
  if (process.env.NODE_ENV !== "production") return;
  const token = process.env.MP_ACCESS_TOKEN ?? "";
  if (token.startsWith("APP_USR-")) return;
  const message = "MP_ACCESS_TOKEN no parece ser de producción (no empieza con APP_USR-)";
  console.error(`[mp-webhook] ${message}`);
  Sentry.captureException(new Error(`mercadopago_sandbox_token_in_production: ${message}`), {
    tags: { area: "mercadopago", mp_stage: "config" },
  });
};

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
  assertProductionMpToken();

  // MP sends `type` and `data.id` either via query or JSON body, depending on topic.
  let parsed: { type?: string; topic?: string; data?: { id?: string }; id?: string } = {};
  try {
    parsed = input.rawBody ? JSON.parse(input.rawBody) : {};
  } catch (e) {
    // Un webhook malformado no debe pasar desapercibido: puede ser un ataque,
    // un cambio de contrato de MP, o un bug de red truncando el body.
    console.error("[mp-webhook] failed to parse rawBody as JSON:", (e as Error).message, {
      rawBodyPreview: input.rawBody?.slice(0, 500),
    });
    Sentry.captureException(e, {
      tags: { area: "mercadopago", mp_stage: "webhook-parse" },
      extra: { rawBodyPreview: input.rawBody?.slice(0, 500) },
    });
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
  let payment: {
    status?: string;
    external_reference?: string | null;
    transaction_amount?: number | null;
  } = {};
  try {
    const config = mpClient();
    const client = new Payment(config);
    const fetched = await client.get({ id: dataId });
    payment = {
      status: fetched.status,
      external_reference: fetched.external_reference,
      transaction_amount: fetched.transaction_amount,
    };
  } catch (e) {
    return err(`mp_payment_fetch_failed: ${(e as Error).message}`);
  }

  const orderId = payment.external_reference;
  if (!orderId) return ok({}); // nothing to update

  const status = payment.status ?? "unknown";
  const mapped = mapOrderStatus(status);

  let orderRow: { id: string; status: string; promoter_link_id: string | null } | null = null;

  if (mapped === "paid") {
    // Backstop anti-doble-cobro: si la orden ya se pagó con OTRO pago (el
    // comprador reintentó con otra tarjeta/Yape y este pago viejo se aprobó
    // igual), reembolsamos ESTE pago y no tocamos la orden. El guard `!== dataId`
    // deja pasar el reintento del webhook del mismo pago (idempotente vía settle).
    const { data: existingPaid } = await db
      .from("orders")
      .select("status, mp_payment_id")
      .eq("id", orderId)
      .maybeSingle<{ status: string; mp_payment_id: string | null }>();
    if (
      existingPaid?.status === "paid" &&
      existingPaid.mp_payment_id &&
      existingPaid.mp_payment_id !== dataId
    ) {
      try {
        await refundMpPayment(dataId);
        Sentry.captureMessage(
          `duplicate_payment_refunded: orden ${orderId} ya pagada por ${existingPaid.mp_payment_id}, reembolsado ${dataId}`,
          "info",
        );
      } catch (e) {
        // Si el reembolso falla, hay que resolverlo a mano — lo dejamos visible.
        Sentry.captureException(e, {
          tags: { area: "mercadopago", mp_stage: "refund-duplicate", orderId },
          extra: { stalePaymentId: dataId, paidWith: existingPaid.mp_payment_id },
        });
      }
      return ok({ orderId, status: "duplicate_refunded" });
    }

    // Liquidación atómica: marca la orden pagada Y reactiva los tickets que el
    // cron pudo anular al expirarla (pago aprobado tardío). Si el aforo ya se
    // revendió, la RPC aborta por el constraint de capacity y NO dejamos la orden
    // "pagada" con QR roto — la marcamos para revisión y alertamos.
    const { data: settled, error: settleErr } = await db.rpc("settle_order_paid", {
      p_order_id: orderId,
      p_paid_at: new Date().toISOString(),
      p_mp_status: status,
      p_mp_payment_id: dataId,
    });
    if (settleErr) {
      const oversold =
        settleErr.code === "23514" || /sold_le_capacity/i.test(settleErr.message);
      Sentry.captureException(
        new Error(`late_payment_settlement_failed: ${settleErr.message}`),
        {
          tags: { area: "mercadopago", mp_stage: "settle", orderId },
          extra: { mpStatus: status, oversold },
        },
      );
      if (oversold) {
        // El stock se revendió tras expirar la orden: pago cobrado que NO podemos
        // honrar sin sobrevender. Reintentar no ayuda. Snapshoteamos mp_status
        // (deja la orden expired/failed con mp_status='approved' → señal clara de
        // "pagado, requiere reembolso") y ack-eamos para que MP deje de reintentar.
        await db
          .from("orders")
          .update({ mp_status: status, mp_payment_id: dataId, updated_at: new Date().toISOString() })
          .eq("id", orderId);
        return ok({ orderId, status: "oversold_needs_refund" });
      }
      // Error transitorio (red/DB): devolver err para que MP reintente el webhook.
      return err(`order_settlement_failed: ${settleErr.message}`);
    }
    if (settled === "not_found") return ok({});
    const { data } = await db
      .from("orders")
      .select("id, status, promoter_link_id")
      .eq("id", orderId)
      .maybeSingle<{ id: string; status: string; promoter_link_id: string | null }>();
    orderRow = data;
  } else {
    // failed / refunded / pending: snapshot de mp_status + cambio de estado. No
    // hay reactivación de tickets acá (la compensación de abajo los anula).
    const update: Record<string, unknown> = {
      mp_status: status,
      mp_payment_id: dataId,
      updated_at: new Date().toISOString(),
    };
    if (mapped === "failed") {
      update.status = "failed";
    } else if (mapped === "refunded") {
      // Reembolso/contracargo: estado terminal. Cambiar status (no solo mp_status)
      // hace que el trigger AFTER UPDATE OF status emita el broadcast y que el
      // rollup (filtra status='paid') deje de contar esta orden.
      update.status = "refunded";
    }
    const { data, error: upErr } = await db
      .from("orders")
      .update(update)
      .eq("id", orderId)
      .select("id, status, promoter_link_id")
      .maybeSingle<{ id: string; status: string; promoter_link_id: string | null }>();
    if (upErr) return err(`order_update_failed: ${upErr.message}`);
    orderRow = data;
  }

  // Despacho del QR por email + WhatsApp al comprador (guest o logueado).
  // No bloquea el ack del webhook, pero corre vía `after()` para que Vercel
  // mantenga viva la invocación hasta que termine (fire-and-forget plano se
  // puede congelar apenas se envía la respuesta, atrasando el envío real
  // minutos y dejando `notification_dispatches` sin fila hasta que algo más
  // reactive la instancia). Errores quedan registrados en esa tabla + Sentry.
  if (mapped === "paid" && orderRow) {
    const orderId = orderRow.id;
    after(() =>
      dispatchTicketDelivery({ db }, orderId).catch((e) => {
        console.error("[mp-webhook] dispatchTicketDelivery failed:", (e as Error).message);
        Sentry.captureException(e, { tags: { area: "ticket-delivery", orderId } });
      }),
    );
    // Un box es una compra: su grupo nace al confirmarse el pago, no al abrir el
    // wallet. Idempotente; corre vía `after()` por la misma razón de arriba.
    after(() =>
      supabaseBoxRepository.ensureForOrder(orderId).catch((e) => {
        console.error("[mp-webhook] ensureForOrder failed:", (e as Error).message);
        Sentry.captureException(e, { tags: { area: "box-provisioning", orderId } });
      }),
    );
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
    amount_cents: Math.round(Money.toCents(payment.transaction_amount ?? 0)),
    raw: parsed as object,
  });

  return ok({ orderId, status });
};

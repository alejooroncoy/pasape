import "server-only";
import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getMpPayment, cancelMpPayment } from "../infrastructure/MercadoPagoClient";
import { dispatchTicketDelivery } from "@/server/notifications/application/DispatchTicketDelivery";
import { supabaseBoxRepository } from "@/server/boxes/infrastructure/repositories/SupabaseBoxRepository";

// Prepara una orden con pago en revisión para reintentar con OTRO medio de pago.
// Es el paso previo a "pagar con otra tarjeta / Yape": deja la orden lista para
// un nuevo cobro sin arrastrar el pago anterior, evitando el doble cobro.
//
//  - already_paid: el pago anterior ya aprobó en MP (el webhook pudo no llegar
//    aún) → liquidamos la orden y NO hay que cobrar de nuevo.
//  - cleared: el pago anterior seguía vivo → lo cancelamos en MP (libera la
//    retención de la tarjeta) y limpiamos el marcador → listo para cobrar el
//    nuevo medio.

export type PrepareRetryOutput = { status: "already_paid" | "cleared" };

type OrderRow = {
  id: string;
  status: string;
  mp_status: string | null;
  mp_payment_id: string | null;
};

export const prepareRetry = async (orderId: string): Promise<Result<PrepareRetryOutput>> => {
  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("id, status, mp_status, mp_payment_id")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();
  if (!order) return err("order_not_found");
  if (order.status === "paid") return ok({ status: "already_paid" });
  if (order.status !== "pending") return err(`order_status_invalid:${order.status}`);

  const prevId = order.mp_payment_id;
  const isLive = order.mp_status === "in_process" || order.mp_status === "pending";

  if (prevId && isLive) {
    // ¿El pago anterior aprobó mientras tanto? El webhook pudo no haber llegado.
    let realStatus: string | undefined;
    try {
      const p = await getMpPayment(prevId);
      realStatus = p.status ?? undefined;
    } catch {
      // No se pudo leer: seguimos limpiando el marcador; el backstop del webhook
      // reembolsa si el pago viejo termina aprobado.
    }

    if (realStatus === "approved") {
      // Ganó el pago anterior: liquidar atómicamente (reactiva tickets si hiciera
      // falta) y no cobrar de nuevo.
      const { data: settled, error: settleErr } = await db.rpc("settle_order_paid", {
        p_order_id: orderId,
        p_paid_at: new Date().toISOString(),
        p_mp_status: "approved",
        p_mp_payment_id: prevId,
      });
      if (settleErr) {
        Sentry.captureException(settleErr, {
          tags: { area: "mercadopago", mp_stage: "retry-settle", orderId },
        });
        return err(`settle_failed: ${settleErr.message}`);
      }
      if (settled !== "not_found") {
        after(() =>
          dispatchTicketDelivery({ db }, orderId).catch((e) => {
            Sentry.captureException(e, { tags: { area: "ticket-delivery", orderId } });
          }),
        );
        after(() =>
          supabaseBoxRepository.ensureForOrder(orderId).catch((e) => {
            Sentry.captureException(e, { tags: { area: "box-provisioning", orderId } });
          }),
        );
      }
      return ok({ status: "already_paid" });
    }

    // Sigue en revisión (o no se pudo leer): cancelar el pago anterior en MP para
    // no cobrar doble. Best-effort — si no se puede, el backstop del webhook
    // reembolsa si el pago viejo termina aprobado.
    try {
      await cancelMpPayment(prevId);
    } catch (e) {
      console.warn("[retry] cancelMpPayment failed:", (e as Error).message);
    }
  }

  // Limpiar el marcador de pago para que el próximo intento (payWithCard/Yape)
  // tome el lock y cobre el nuevo medio sin arrastrar el pago viejo.
  await db
    .from("orders")
    .update({ mp_status: null, mp_payment_id: null, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending");

  return ok({ status: "cleared" });
};

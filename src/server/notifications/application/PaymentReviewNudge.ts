import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getMpPayment } from "@/server/payments/infrastructure/MercadoPagoClient";
import { deliverPaymentReview, type PaymentReviewOrder } from "./DispatchPaymentReview";

// Recordatorio proactivo: cuando el evento se acerca (< 72h) y el pago SIGUE en
// revisión (in_process), le recordamos al comprador que reintente con otro medio
// o nos mande la captura del monto preautorizado — para no quedarse sin entrada
// el día del evento. Antes de enviar revalidamos el pago en MP (evita molestar si
// ya aprobó o si ya fue rechazado; esos casos los cubre el webhook).
//
// Pensado para correr desde un cron (Vercel Cron → /api/cron/payment-review-nudge)
// cada pocas horas. Idempotente vía orders.payment_nudge_sent_at.

const WINDOW_HOURS = 72;
const BATCH = 100;

type Row = PaymentReviewOrder & { mp_payment_id: string | null };

export const runPaymentReviewNudge = async (
  db: SupabaseClient = supabaseAdmin(),
): Promise<{ scanned: number; nudged: number; approved: number; rejected: number }> => {
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_HOURS * 3600_000);

  const { data, error } = await db
    .from("orders")
    .select(
      "id, buyer_id, event_id, guest_email, guest_phone, guest_name, mp_payment_id, event:events!inner(starts_at)",
    )
    .eq("status", "pending")
    .eq("mp_status", "in_process")
    .not("mp_payment_id", "is", null)
    .is("payment_nudge_sent_at", null)
    .gte("event.starts_at", now.toISOString())
    .lte("event.starts_at", until.toISOString())
    .limit(BATCH);

  if (error) {
    Sentry.captureException(error, { tags: { area: "payment-review-nudge", op: "query" } });
    return { scanned: 0, nudged: 0, approved: 0, rejected: 0 };
  }

  const rows = (data ?? []) as unknown as Row[];
  let nudged = 0;
  let approved = 0;
  let rejected = 0;

  for (const order of rows) {
    if (!order.mp_payment_id) continue;

    // Revalidar en MP: si ya se resolvió, no molestamos (el webhook lo cubre).
    let status: string | undefined;
    try {
      const p = await getMpPayment(order.mp_payment_id);
      status = p.status ?? undefined;
    } catch {
      // No se pudo leer: mejor no nudgear con info incierta. Reintenta el próximo run.
      continue;
    }
    if (status === "approved") {
      approved += 1;
      continue;
    }
    if (status === "rejected" || status === "cancelled") {
      rejected += 1;
      continue;
    }

    // Sigue en revisión: claim atómico del nudge y envío.
    const { data: claimed } = await db
      .from("orders")
      .update({ payment_nudge_sent_at: new Date().toISOString() })
      .eq("id", order.id)
      .is("payment_nudge_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      await deliverPaymentReview(db, order, "in_review");
      nudged += 1;
    } catch (e) {
      Sentry.captureException(e, {
        tags: { area: "payment-review-nudge", op: "deliver", orderId: order.id },
      });
    }
  }

  return { scanned: rows.length, nudged, approved, rejected };
};

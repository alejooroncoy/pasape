import "server-only";
import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { dispatchTicketDelivery } from "@/server/notifications/application/DispatchTicketDelivery";
import { supabaseBoxRepository } from "@/server/boxes/infrastructure/repositories/SupabaseBoxRepository";

/** Liquida una orden aprobada vía settle_order_paid + entrega + box. */
export async function settleApprovedPayment(
  orderId: string,
  paymentId: string,
  mpStatus: string,
): Promise<Result<{ alreadyPaid: boolean }>> {
  const db = supabaseAdmin();
  const { data: settled, error: settleErr } = await db.rpc("settle_order_paid", {
    p_order_id: orderId,
    p_paid_at: new Date().toISOString(),
    p_mp_status: mpStatus,
    p_mp_payment_id: paymentId,
  });
  if (settleErr) {
    Sentry.captureException(settleErr, {
      tags: { area: "mercadopago", mp_stage: "settle-sync", orderId },
    });
    return err(`settle_failed: ${settleErr.message}`);
  }
  if (settled === "not_found") return ok({ alreadyPaid: true });

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

  return ok({ alreadyPaid: false });
}

import "server-only";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

/** Segundos hasta que un lock colgado (crash/red) se libera solo. */
export const PAYMENT_LOCK_TTL_SECONDS = 300;

/** Lock atómico con TTL — evita doble cobro y desbloquea reintentos tras timeout. */
export const acquireOrderPaymentLock = async (orderId: string): Promise<boolean> => {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("acquire_order_payment_lock", {
    p_order_id: orderId,
    p_ttl_seconds: PAYMENT_LOCK_TTL_SECONDS,
  });
  if (error) {
    console.error("[payments] acquire_order_payment_lock failed:", error.message);
    return false;
  }
  return data === true;
};

export const releaseOrderPaymentLock = async (orderId: string): Promise<void> => {
  const db = supabaseAdmin();
  await db
    .from("orders")
    .update({ mp_status: null, mp_lock_expires_at: null })
    .eq("id", orderId)
    .eq("mp_status", "locked");
};

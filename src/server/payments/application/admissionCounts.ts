import "server-only";
import type { supabaseAdmin } from "@/server/_shared/supabase/admin";

type Db = ReturnType<typeof supabaseAdmin>;

// Entradas individuales (no box) de una orden — para el cap por instrumento de
// pago. Los boxes se venden enteros (el host invita), no cuentan como stock.
export async function countOrderAdmission(db: Db, orderId: string): Promise<number> {
  const { count } = await db
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .is("box_label", null)
    .in("status", ["active", "used"]);
  return count ?? 0;
}

// Entradas individuales YA PAGADAS con este instrumento de pago (columna
// card_hash o yape_hash) en el evento. La huella es un hash HMAC no-PII.
export async function countPaidAdmissionByInstrument(
  db: Db,
  eventId: string,
  column: "card_hash" | "yape_hash",
  instrumentHash: string,
): Promise<number> {
  const { data: paidOrders } = await db
    .from("orders")
    .select("id")
    .eq("event_id", eventId)
    .eq(column, instrumentHash)
    .eq("status", "paid")
    .returns<Array<{ id: string }>>();
  const ids = (paidOrders ?? []).map((o) => o.id);
  if (ids.length === 0) return 0;
  const { count } = await db
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .in("order_id", ids)
    .is("box_label", null)
    .in("status", ["active", "used"]);
  return count ?? 0;
}

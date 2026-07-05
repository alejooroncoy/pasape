import { NextResponse } from "next/server";
import { runPaymentReviewNudge } from "@/server/notifications/application/PaymentReviewNudge";

// Cron (pg_cron + pg_net): recordatorio proactivo a compradores con pago en
// revisión cuyo evento se acerca. El job es IDEMPOTENTE — cada orden se nudgea a
// lo sumo una vez (orders.payment_nudge_sent_at), así que re-dispararlo no manda
// avisos repetidos. Por eso no requiere secreto: el peor caso de una llamada
// externa es un no-op. Si más adelante se quiere blindar, basta con un header
// check contra una env.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = async () => {
  const result = await runPaymentReviewNudge();
  return NextResponse.json({ data: result });
};

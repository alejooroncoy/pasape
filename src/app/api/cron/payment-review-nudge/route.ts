import { NextResponse, type NextRequest } from "next/server";
import { runPaymentReviewNudge } from "@/server/notifications/application/PaymentReviewNudge";

// Cron (Vercel Cron): recordatorio proactivo a compradores con pago en revisión
// cuya evento se acerca. Protegido por CRON_SECRET — Vercel Cron manda
// `Authorization: Bearer <CRON_SECRET>` cuando la env está seteada.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret) {
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Sin secret en prod no exponemos el job (evita que cualquiera lo dispare).
    return NextResponse.json({ error: "cron_secret_not_set" }, { status: 503 });
  }
  const result = await runPaymentReviewNudge();
  return NextResponse.json({ data: result });
};

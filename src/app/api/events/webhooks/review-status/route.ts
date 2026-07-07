import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { dispatchEventReviewResult } from "@/server/notifications/application/DispatchEventReviewResult";

// Llamado por el trigger de Postgres `notify_event_review_decision` (pg_net,
// ver migración 20260706180000) cuando Pasape aprueba o rechaza un evento a
// mano en el Table Editor. No lo llama el frontend — autenticado por secreto
// compartido (Supabase Vault en la DB, env var acá), no por sesión de usuario.

const bodySchema = z.object({
  eventId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().nullable().optional(),
});

export const POST = async (req: NextRequest) => {
  const secret = process.env.EVENTS_REVIEW_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  await dispatchEventReviewResult(
    parsed.data.eventId,
    parsed.data.decision,
    parsed.data.reason ?? null,
  );
  return NextResponse.json({ ok: true });
};

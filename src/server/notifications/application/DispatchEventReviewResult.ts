import "server-only";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import {
  EventReviewResultEmail,
  type EventReviewDecision,
} from "../emails/EventReviewResultEmail";

// Envía el correo al organizador cuando Pasape decide sobre un evento en
// pending_review (aprobar -> published, o rechazar -> draft + rejected_reason).
// Lo dispara el trigger `notify_event_review_decision` (ver migración
// 20260706180000) vía /api/events/webhooks/review-status — no algo que el
// organizador vea nunca en el request/response, así que best-effort puro:
// nunca lanza, solo loggea si algo falla.

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/$/, "");

type EventRow = {
  id: string;
  slug: string;
  title: string;
  created_by: string;
};

export const dispatchEventReviewResult = async (
  eventId: string,
  decision: EventReviewDecision,
  reason: string | null,
): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[dispatchEventReviewResult] RESEND_API_KEY o RESEND_FROM_EMAIL no seteado — skip");
    return;
  }

  try {
    const db = supabaseAdmin();
    const { data: event } = await db
      .from("events")
      .select("id, slug, title, created_by")
      .eq("id", eventId)
      .maybeSingle<EventRow>();
    if (!event) return;

    const { data: organizer } = await db
      .from("profiles")
      .select("email, full_name")
      .eq("id", event.created_by)
      .maybeSingle<{ email: string | null; full_name: string | null }>();
    if (!organizer?.email) return;

    // Dynamic import: la dep es opcional. Si no está instalada, no rompe la build
    // (mismo patrón que ResendEmailSender.ts / InviteEmailSender.ts).
    const mod = (await import("resend").catch(() => null)) as
      | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
      | null;
    if (!mod) {
      console.warn("[dispatchEventReviewResult] paquete `resend` no instalado — skip");
      return;
    }

    const props = {
      decision,
      organizerName: organizer.full_name?.trim()?.split(" ")[0] || "organizador/a",
      eventTitle: event.title,
      reason,
      eventUrl: `${APP_ORIGIN}/events/${event.slug}`,
      editUrl: `${APP_ORIGIN}/org/events/${event.slug}`,
      appOrigin: APP_ORIGIN,
    };
    const [html, text] = await Promise.all([
      render(EventReviewResultEmail(props)),
      render(EventReviewResultEmail(props), { plainText: true }),
    ]);

    const subject =
      decision === "approved"
        ? `Tu evento "${event.title}" fue aprobado`
        : `Tu evento "${event.title}" necesita un ajuste`;

    const client = new mod.Resend(apiKey);
    await client.emails.send({ from, to: organizer.email, subject, html, text });
  } catch (err) {
    console.error("[dispatchEventReviewResult] envío falló:", err instanceof Error ? err.message : err);
  }
};

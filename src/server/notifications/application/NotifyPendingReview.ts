import "server-only";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { EventPendingReviewEmail } from "../emails/EventPendingReviewEmail";

// Aviso interno (Resend, no WhatsApp) cada vez que un evento cae en
// pending_review por primera vez — ver AGENTS.md / [[review-eventos-pending]].
// Sin panel de staff todavía: el correo trae un prompt listo para pegar en
// Claude Code y que revise el evento (Supabase + criterio) antes de aprobar
// a mano (events.status -> 'published'). Best-effort: nunca bloquea el flujo
// del organizador si Resend falla o no está configurado.

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/$/, "");
const TEAM_EMAIL = "team@pasape.lat";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  venue: string | null;
  starts_at: string;
  category: string | null;
  organization_id: string;
  created_by: string;
};

const buildPrompt = (
  event: EventRow,
  orgName: string,
  organizerEmail: string | null,
): string =>
  `Revisa el evento pendiente de revisión "${event.title}" (slug: ${event.slug}, id: ${event.id}) de la organización "${orgName}" (organization_id: ${event.organization_id}) en el repo pasape-app.

1. Consulta en Supabase la fila completa de \`events\` con id=${event.id} y sus \`ticket_types\` asociados (precios, capacidad/asientos, kind).
2. Revisa también el historial del organizador: otros eventos de organization_id=${event.organization_id} y si tiene quejas/reclamos previos (tabla complaints o similar).
3. Verifica: título/descripción sin contenido ilegal, spam, estafa o discurso de odio; precios y capacidad razonables; fecha coherente (no en el pasado, no absurdamente lejana); venue verosímil.
4. Si todo está en orden, aprueba: \`update events set status = 'published' where id = '${event.id}'\`.
5. Si algo no cuadra, NO lo apruebes — déjalo en pending_review y explica exactamente qué está mal para contactar al organizador (${organizerEmail ?? "sin email registrado"}).`;

export const notifyPendingReview = async (eventId: string): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[notifyPendingReview] RESEND_API_KEY o RESEND_FROM_EMAIL no seteado — skip");
    return;
  }

  try {
    const db = supabaseAdmin();
    const { data: event } = await db
      .from("events")
      .select("id, slug, title, description, venue, starts_at, category, organization_id, created_by")
      .eq("id", eventId)
      .maybeSingle<EventRow>();
    if (!event) return;

    const [{ data: org }, { data: organizer }] = await Promise.all([
      db.from("organizations").select("name").eq("id", event.organization_id).maybeSingle<{ name: string }>(),
      db.from("profiles").select("email").eq("id", event.created_by).maybeSingle<{ email: string | null }>(),
    ]);
    const orgName = org?.name ?? "(organización desconocida)";

    // Dynamic import: la dep es opcional. Si no está instalada, no rompe la build
    // (mismo patrón que ResendEmailSender.ts / InviteEmailSender.ts).
    const mod = (await import("resend").catch(() => null)) as
      | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
      | null;
    if (!mod) {
      console.warn("[notifyPendingReview] paquete `resend` no instalado — skip");
      return;
    }

    const panelUrl = `${APP_ORIGIN}/org/events/${event.slug}`;
    const prompt = buildPrompt(event, orgName, organizer?.email ?? null);
    const props = { eventTitle: event.title, orgName, panelUrl, prompt };
    const [html, text] = await Promise.all([
      render(EventPendingReviewEmail(props)),
      render(EventPendingReviewEmail(props), { plainText: true }),
    ]);

    const client = new mod.Resend(apiKey);
    await client.emails.send({
      from,
      to: TEAM_EMAIL,
      subject: `Evento pendiente de revisión: "${event.title}"`,
      html,
      text,
    });
  } catch (err) {
    console.error("[notifyPendingReview] envío falló:", err instanceof Error ? err.message : err);
  }
};

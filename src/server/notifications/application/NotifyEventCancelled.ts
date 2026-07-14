import "server-only";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { EventCancelledEmail } from "../emails/EventCancelledEmail";

// Aviso interno (Resend, no WhatsApp) cuando un organizador cancela un evento
// publicado — ver AGENTS.md, RequestRefund.ts. Cancelar un evento SOLO
// notifica a los compradores in-app (ver UpdateEvent.ts notifyBuyers); ningún
// reembolso se dispara automático. Este correo es la señal para que el
// equipo ejecute el plan de reembolso a mano, igual que con las solicitudes
// individuales de RequestRefund.ts. Best-effort: nunca bloquea la
// cancelación del organizador si Resend falla o no está configurado.

const TEAM_EMAIL = "team@pasape.lat";

const formatAmount = (cents: number, currency: string): string =>
  `${currency === "PEN" ? "S/" : currency} ${(cents / 100).toFixed(2)}`;

export const notifyEventCancelled = async (eventId: string, eventTitle: string, orgId: string): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[notifyEventCancelled] RESEND_API_KEY o RESEND_FROM_EMAIL no seteado — skip");
    return;
  }

  try {
    const db = supabaseAdmin();
    const [{ data: org }, { data: orders }] = await Promise.all([
      db.from("organizations").select("name").eq("id", orgId).maybeSingle<{ name: string }>(),
      db
        .from("orders")
        .select("id, total_cents, currency")
        .eq("event_id", eventId)
        .eq("status", "paid"),
    ]);
    const orgName = org?.name ?? "(organización desconocida)";
    const paidOrders = (orders as Array<{ id: string; total_cents: number; currency: string }> | null) ?? [];
    const currency = paidOrders[0]?.currency ?? "PEN";
    const totalCents = paidOrders.reduce((sum, o) => sum + o.total_cents, 0);

    // Dynamic import: la dep es opcional (mismo patrón que ResendEmailSender.ts /
    // NotifyPendingReview.ts) — no rompe la build si no está instalada.
    const mod = (await import("resend").catch(() => null)) as
      | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
      | null;
    if (!mod) {
      console.warn("[notifyEventCancelled] paquete `resend` no instalado — skip");
      return;
    }

    const totalAmount = formatAmount(totalCents, currency);
    const html = await render(
      EventCancelledEmail({ eventTitle, orgName, paidOrdersCount: paidOrders.length, totalAmount }),
    );
    const text = `${orgName} canceló "${eventTitle}". ${paidOrders.length} órdenes pagadas, ${totalAmount} en juego. Ejecutar plan de reembolso a mano.`;

    const client = new mod.Resend(apiKey);
    await client.emails.send({
      from,
      to: TEAM_EMAIL,
      subject: `Evento cancelado: "${eventTitle}" — ${paidOrders.length} órdenes pagadas`,
      html,
      text,
    });
  } catch (err) {
    console.error("[notifyEventCancelled] envío falló:", err instanceof Error ? err.message : err);
  }
};

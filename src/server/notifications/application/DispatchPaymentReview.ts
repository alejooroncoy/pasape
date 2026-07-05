import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { WhatsAppNotificationSender } from "../infrastructure/WhatsAppNotificationSender";
import { PaymentReviewEmail, type PaymentReviewKind } from "../emails/PaymentReviewEmail";

// Avisa al comprador cuando su pago queda EN REVISIÓN (in_process) o es RECHAZADO,
// para que reintente con otro medio o mande la captura del preautorizado. Correo
// (Resend) + WhatsApp (plantilla). El WhatsApp es best-effort: si la plantilla no
// está aprobada en Meta aún, igual sale el correo.
//
// Anti-spam: MP puede disparar el mismo estado varias veces. Un claim atómico
// sobre orders.payment_review_notified evita reenviar el MISMO tipo; un tipo
// distinto (in_review → luego rejected) sí se envía.

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/$/, "");

type Deps = { db?: SupabaseClient };

type OrderRow = {
  id: string;
  buyer_id: string | null;
  event_id: string;
  guest_email: string | null;
  guest_phone: string | null;
  guest_name: string | null;
};

export const dispatchPaymentReview = async (
  deps: Deps,
  orderId: string,
  kind: PaymentReviewKind,
): Promise<{ sent: boolean; emailSent: boolean; whatsappSent: boolean }> => {
  const db = deps.db ?? supabaseAdmin();

  // Claim atómico: solo enviamos si el último aviso enviado NO fue de este tipo.
  const { data: claimed } = await db
    .from("orders")
    .update({ payment_review_notified: kind })
    .eq("id", orderId)
    .or(`payment_review_notified.is.null,payment_review_notified.neq.${kind}`)
    .select("id, buyer_id, event_id, guest_email, guest_phone, guest_name")
    .maybeSingle<OrderRow>();
  if (!claimed) return { sent: false, emailSent: false, whatsappSent: false };
  const order = claimed;

  // Contactos: guest (email/phone reales en la orden) o profile del buyer. El
  // email del profile de un guest es sintético, por eso se prefiere guest_email.
  let email = order.guest_email;
  let phone = order.guest_phone;
  let name = order.guest_name;
  if (order.buyer_id) {
    const { data: prof } = await db
      .from("profiles")
      .select("email, phone, full_name")
      .eq("id", order.buyer_id)
      .maybeSingle<{ email: string | null; phone: string | null; full_name: string | null }>();
    email = email ?? prof?.email ?? null;
    phone = phone ?? prof?.phone ?? null;
    name = name ?? prof?.full_name ?? null;
  }

  const { data: event } = await db
    .from("events")
    .select("title, starts_at, slug")
    .eq("id", order.event_id)
    .maybeSingle<{ title: string; starts_at: string; slug: string }>();
  if (!event) return { sent: false, emailSent: false, whatsappSent: false };

  const holderName = (name?.trim()?.split(" ")[0]) || "Hola";
  const retryUrl = `${APP_ORIGIN}/es/events/${event.slug}/buy?order=${orderId}`;

  // Correo (funciona ya). WhatsApp (best-effort, requiere plantilla aprobada).
  let emailSent = false;
  let whatsappSent = false;

  if (email) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (apiKey && from) {
      try {
        const props = {
          kind,
          holderName,
          eventTitle: event.title,
          eventStartsAt: event.starts_at,
          retryUrl,
          appOrigin: APP_ORIGIN,
        };
        const html = await render(PaymentReviewEmail(props));
        const text = await render(PaymentReviewEmail(props), { plainText: true });
        const mod = (await import("resend").catch(() => null)) as
          | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
          | null;
        if (mod) {
          const subject =
            kind === "rejected"
              ? `Tu pago para ${event.title} no se confirmó`
              : `Tu pago para ${event.title} está en revisión`;
          await new mod.Resend(apiKey).emails.send({ from, to: email, subject, html, text });
          emailSent = true;
        }
      } catch (err) {
        console.error("[dispatchPaymentReview] email falló:", (err as Error).message);
      }
    }
  }

  if (phone) {
    whatsappSent = await new WhatsAppNotificationSender().sendPaymentReview({
      phone,
      kind,
      holderName,
      eventTitle: event.title,
      retryUrl,
    });
  }

  return { sent: emailSent || whatsappSent, emailSent, whatsappSent };
};

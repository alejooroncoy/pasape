import { render } from "@react-email/components";
import type {
  NotificationSender,
  TicketDeliveryInput,
  TicketDeliveryResult,
} from "../ports/NotificationSender";
import { TicketDeliveryEmail } from "../emails/TicketDeliveryEmail";
import { humanizeName } from "../humanizeName";

// Adapter de email vía Resend. Si faltan `RESEND_API_KEY` o `RESEND_FROM_EMAIL`,
// degrada a no-op + log para no romper el flujo de checkout. El SDK se importa
// de forma dinámica para que la build no explote si la dep no está instalada.

// Origen absoluto del app para resolver la URL del logo en el template.
// En dev necesita ser una URL pública (ngrok / Vercel preview) para que el
// client de correo pueda cargar el logo — no puede alcanzar localhost.
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/$/, "");

export class ResendEmailSender implements NotificationSender {
  async sendTicketDelivery(input: TicketDeliveryInput): Promise<TicketDeliveryResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      console.warn("[ResendEmailSender] RESEND_API_KEY o RESEND_FROM_EMAIL no seteado — skip email");
      return { emailSent: false, whatsappSent: false };
    }
    if (!input.to.email) {
      return { emailSent: false, whatsappSent: false };
    }
    try {
      // Dynamic import: la dep es opcional. Si no está instalada, no rompe la build.
      const mod = (await import("resend").catch(() => null)) as
        | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
        | null;
      if (!mod) {
        console.warn("[ResendEmailSender] paquete `resend` no instalado — skip");
        return { emailSent: false, whatsappSent: false };
      }
      const emailProps = {
        holderName: humanizeName(input.holderName),
        eventTitle: input.eventTitle,
        eventStartsAt: input.eventStartsAt,
        eventVenue: input.eventVenue,
        ticketUrl: input.ticketUrl,
        walletSignupUrl: input.walletSignupUrl,
        ticketCount: input.ticketCount,
        appOrigin: APP_ORIGIN,
      };
      const html = await render(TicketDeliveryEmail(emailProps));
      const text = await render(TicketDeliveryEmail(emailProps), { plainText: true });

      const subject =
        input.ticketCount > 1
          ? `Tus ${input.ticketCount} entradas para ${input.eventTitle}`
          : `Tu entrada para ${input.eventTitle}`;

      const client = new mod.Resend(apiKey);
      await client.emails.send({
        from,
        to: input.to.email,
        subject,
        html,
        text,
      });
      return { emailSent: true, whatsappSent: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ResendEmailSender] envío falló:", message);
      return {
        emailSent: false,
        whatsappSent: false,
        errors: [{ channel: "email", message }],
      };
    }
  }
}

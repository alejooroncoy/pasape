import { render } from "@react-email/components";
import { PromoterApprovedEmail } from "../emails/PromoterApprovedEmail";

type PromoterApprovedEmailInput = {
  to: string;
  promoterName: string | null;
  orgName: string;
  eventTitle: string;
  panelUrl: string;
  shareUrl: string;
};

// Origen absoluto del app para resolver la URL del logo en el template. En dev
// necesita ser una URL pública si quieres ver el logo en el correo real.
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/$/, "");

// Correo "te aprobaron como promotor" vía Resend. Mismo patrón degradable que
// InviteEmailSender: si faltan envs o el paquete, es no-op + log (nunca rompe la
// aprobación, que es lo importante).
export class PromoterApprovedEmailSender {
  /** true si el email se envió. false = no-op (faltan envs / sin paquete / error). */
  async send(input: PromoterApprovedEmailInput): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      console.warn("[PromoterApprovedEmailSender] RESEND_API_KEY o RESEND_FROM_EMAIL no seteado — skip");
      return false;
    }
    try {
      const mod = (await import("resend").catch(() => null)) as
        | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
        | null;
      if (!mod) {
        console.warn("[PromoterApprovedEmailSender] paquete `resend` no instalado — skip");
        return false;
      }

      const emailProps = {
        promoterName: input.promoterName,
        orgName: input.orgName,
        eventTitle: input.eventTitle,
        panelUrl: input.panelUrl,
        shareUrl: input.shareUrl,
        appOrigin: APP_ORIGIN,
      };
      const html = await render(PromoterApprovedEmail(emailProps));
      const text = await render(PromoterApprovedEmail(emailProps), { plainText: true });

      const client = new mod.Resend(apiKey);
      await client.emails.send({
        from,
        to: input.to,
        subject: `¡Te aprobaron como promotor de ${input.orgName}!`,
        html,
        text,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[PromoterApprovedEmailSender] envío falló:", message);
      return false;
    }
  }
}

export const promoterApprovedEmailSender = new PromoterApprovedEmailSender();

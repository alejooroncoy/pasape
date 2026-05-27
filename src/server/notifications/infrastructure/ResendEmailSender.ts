import type {
  NotificationSender,
  TicketDeliveryInput,
  TicketDeliveryResult,
} from "../ports/NotificationSender";

// Adapter de email vía Resend. Si faltan `RESEND_API_KEY` o `RESEND_FROM_EMAIL`,
// degrada a no-op + log para no romper el flujo de checkout. El SDK se importa
// de forma dinámica para que la build no explote si la dep no está instalada.

const buildHtml = (input: TicketDeliveryInput): string => {
  const fechaFmt = (() => {
    try {
      return new Intl.DateTimeFormat("es-PE", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Lima",
      }).format(new Date(input.eventStartsAt));
    } catch {
      return input.eventStartsAt;
    }
  })();
  const venue = input.eventVenue ? `<div style="color:#666">${input.eventVenue}</div>` : "";
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0A0A0F;color:#fff;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#140C28;border-radius:16px;padding:28px">
    <h1 style="font-size:22px;margin:0 0 12px">Tu entrada está lista</h1>
    <p style="color:rgba(255,255,255,0.7);margin:0 0 18px">Hola ${escapeHtml(input.holderName)}, tu entrada para <strong>${escapeHtml(input.eventTitle)}</strong> ya está disponible.</p>
    <div style="background:rgba(124,58,237,0.18);border-radius:12px;padding:14px 16px;margin-bottom:18px">
      <div style="font-weight:600">${escapeHtml(input.eventTitle)}</div>
      <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px">${escapeHtml(fechaFmt)}</div>
      ${venue}
    </div>
    <a href="${input.ticketUrl}" style="display:block;text-align:center;background:#7C3AED;color:#fff;padding:14px 18px;border-radius:999px;text-decoration:none;font-weight:600;margin-bottom:12px">Ver mi entrada</a>
    <a href="${input.walletSignupUrl}" style="display:block;text-align:center;background:rgba(255,255,255,0.08);color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:500">Guardar mis entradas en Pasape</a>
    <p style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:24px;line-height:1.5">Mostrá el QR en puerta. No le saques screenshot — el QR rota cada pocos segundos.</p>
  </div>
</body></html>`;
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

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
      const client = new mod.Resend(apiKey);
      await client.emails.send({
        from,
        to: input.to.email,
        subject: `Tu entrada para ${input.eventTitle}`,
        html: buildHtml(input),
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

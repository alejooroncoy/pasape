import { render } from "@react-email/components";
import { RecoveryOtpEmail } from "../emails/RecoveryOtpEmail";

// Mismo adapter/degradación que ResendEmailSender: si faltan las envs o el
// paquete `resend`, no rompe el flujo — el caller decide qué hacer con
// `sent: false` (acá sí importa, a diferencia de la entrega de tickets: el
// correo es el ÚNICO canal de recuperación, no uno redundante).
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/$/, "");

export type SendRecoveryOtpEmailInput = {
  to: string;
  code: string;
  ttlMinutes: number;
};

export const sendRecoveryOtpEmail = async (
  input: SendRecoveryOtpEmailInput,
): Promise<{ sent: boolean; error?: string }> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[ResendRecoveryOtpSender] RESEND_API_KEY o RESEND_FROM_EMAIL no seteado — skip email");
    return { sent: false, error: "resend_not_configured" };
  }

  try {
    const mod = (await import("resend").catch(() => null)) as
      | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
      | null;
    if (!mod) {
      console.warn("[ResendRecoveryOtpSender] paquete `resend` no instalado — skip");
      return { sent: false, error: "resend_not_installed" };
    }

    const emailProps = { code: input.code, ttlMinutes: input.ttlMinutes, appOrigin: APP_ORIGIN };
    const html = await render(RecoveryOtpEmail(emailProps));
    const text = await render(RecoveryOtpEmail(emailProps), { plainText: true });

    const client = new mod.Resend(apiKey);
    await client.emails.send({
      from,
      to: input.to,
      subject: `${input.code} es tu código de recuperación`,
      html,
      text,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ResendRecoveryOtpSender] envío falló:", message);
    return { sent: false, error: message };
  }
};

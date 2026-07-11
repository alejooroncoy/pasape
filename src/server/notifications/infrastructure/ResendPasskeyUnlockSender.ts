import { render } from "@react-email/components";
import { PasskeyUnlockEmail } from "../emails/PasskeyUnlockEmail";

// Mismo adapter/degradación que ResendRecoveryOtpSender: el correo es el único
// canal para este código, así que `sent: false` sí importa al caller.
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/$/, "");

export type SendPasskeyUnlockEmailInput = {
  to: string;
  code: string;
  ttlMinutes: number;
};

export const sendPasskeyUnlockEmail = async (
  input: SendPasskeyUnlockEmailInput,
): Promise<{ sent: boolean; error?: string }> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[ResendPasskeyUnlockSender] RESEND_API_KEY o RESEND_FROM_EMAIL no seteado — skip email");
    return { sent: false, error: "resend_not_configured" };
  }

  try {
    const mod = (await import("resend").catch(() => null)) as
      | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
      | null;
    if (!mod) {
      console.warn("[ResendPasskeyUnlockSender] paquete `resend` no instalado — skip");
      return { sent: false, error: "resend_not_installed" };
    }

    const emailProps = { code: input.code, ttlMinutes: input.ttlMinutes, appOrigin: APP_ORIGIN };
    const html = await render(PasskeyUnlockEmail(emailProps));
    const text = await render(PasskeyUnlockEmail(emailProps), { plainText: true });

    const client = new mod.Resend(apiKey);
    await client.emails.send({
      from,
      to: input.to,
      subject: `${input.code} es tu código para entrar`,
      html,
      text,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ResendPasskeyUnlockSender] envío falló:", message);
    return { sent: false, error: message };
  }
};

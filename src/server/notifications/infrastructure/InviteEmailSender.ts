import { render } from "@react-email/components";
import { InviteEmail } from "../emails/InviteEmail";

type InviteEmailInput = {
  to: string;
  inviterName: string | null;
  scopeLabel: string;
  roleLabel: string;
  inviteUrl: string;
  expiresAt: string;
};

// Origen absoluto del app para resolver URLs de logo en el template.
// En dev necesita ser una URL pública (ngrok / Vercel preview) si quieres ver
// el logo en el correo real — los clients no pueden alcanzar localhost.
const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://pasape.lat").replace(/\/$/, "");

export class InviteEmailSender {
  /** Devuelve true si el email se envió. False = no-op (faltan envs / sin paquete / error). */
  async send(input: InviteEmailInput): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      console.warn("[InviteEmailSender] RESEND_API_KEY o RESEND_FROM_EMAIL no seteado — skip");
      return false;
    }
    try {
      const mod = (await import("resend").catch(() => null)) as
        | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
        | null;
      if (!mod) {
        console.warn("[InviteEmailSender] paquete `resend` no instalado — skip");
        return false;
      }

      const emailProps = {
        inviterName: input.inviterName,
        scopeLabel: input.scopeLabel,
        roleLabel: input.roleLabel,
        inviteUrl: input.inviteUrl,
        expiresAt: input.expiresAt,
        appOrigin: APP_ORIGIN,
      };
      const html = await render(InviteEmail(emailProps));
      const text = await render(InviteEmail(emailProps), { plainText: true });

      const client = new mod.Resend(apiKey);
      await client.emails.send({
        from,
        to: input.to,
        subject: `Te invitaron a ${input.scopeLabel} en Pasape`,
        html,
        text,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[InviteEmailSender] envío falló:", message);
      return false;
    }
  }
}

export const inviteEmailSender = new InviteEmailSender();

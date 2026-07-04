// Envía invitaciones de equipo por WhatsApp. El transporte (Kapso/Meta) lo
// resuelve el WhatsAppGateway; este sender solo arma el template.
//
// === Template requerido en Meta (registrar/aprobar en el dashboard del proveedor) ===
//
//   Nombre:   team_invitation       (override con WA_INVITE_TEMPLATE_NAME)
//   Idioma:   es                    (override con WA_INVITE_TEMPLATE_LANG)
//   Tipo:     UTILITY
//
//   Cuerpo (named parameters):
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ Hola! {{inviter_name}} te invitó a {{scope_label}} como             │
//   │ {{role_label}} en Pasape. Toca el botón para aceptar.               │
//   │ La invitación caduca en {{expires_in}}.                             │
//   └──────────────────────────────────────────────────────────────────────┘
//
//   Botón URL (dinámico):
//     Texto: "Aceptar invitación"
//     URL:   https://pasape.lat/es/invites/{{1}}    ← {{1}} = token
//
// Meta exige que las variables del cuerpo NO estén al principio ni al final.
// Por eso el "Hola!" abre la frase. El botón URL solo soporta variables
// posicionales (no nombradas), por eso usamos {{1}} en vez de {{token}}.

import { whatsAppGateway } from "./whatsapp";
import { bodyComponent, urlButtonComponent } from "./whatsapp/components";

type InviteWhatsAppInput = {
  to: string; // phone E.164 (con o sin "+")
  inviterName: string | null;
  scopeLabel: string;
  roleLabel: string;
  token: string; // se pone en el botón URL dinámico
  expiresAt: string; // ISO
};

const formatExpiresIn = (iso: string): string => {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "menos de 1 día";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "1 día" : `${days} días`;
};

export class InviteWhatsAppSender {
  /** Devuelve true si se envió. False = no-op (proveedor sin configurar / error). */
  async send(input: InviteWhatsAppInput): Promise<boolean> {
    const gateway = whatsAppGateway();
    const templateName =
      process.env.WA_INVITE_TEMPLATE_NAME ??
      process.env.KAPSO_WA_INVITE_TEMPLATE_NAME ??
      "team_invitation";
    const templateLang =
      process.env.WA_INVITE_TEMPLATE_LANG ??
      process.env.KAPSO_WA_INVITE_TEMPLATE_LANG ??
      "es";

    if (!gateway.configured()) {
      console.warn("[InviteWhatsAppSender] proveedor de WhatsApp sin configurar — skip");
      return false;
    }

    try {
      await gateway.sendTemplate({
        to: input.to,
        templateName,
        languageCode: templateLang,
        components: [
          bodyComponent({
            inviter_name: input.inviterName?.trim() || "Tu invitador",
            scope_label: input.scopeLabel,
            role_label: input.roleLabel,
            expires_in: formatExpiresIn(input.expiresAt),
          }),
          urlButtonComponent(input.token),
        ],
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[InviteWhatsAppSender] envío falló:", message);
      return false;
    }
  }
}

export const inviteWhatsAppSender = new InviteWhatsAppSender();

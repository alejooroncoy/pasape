// Envía invitaciones por WhatsApp vía Kapso Meta Proxy API.
//
// === Template requerido en Meta WhatsApp (a registrar/aprobar en Kapso/Meta dashboard) ===
//
//   Nombre:   team_invitation       (override con KAPSO_WA_INVITE_TEMPLATE_NAME)
//   Idioma:   es                    (override con KAPSO_WA_INVITE_TEMPLATE_LANG)
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

type InviteWhatsAppInput = {
  to: string;          // phone E.164 (con o sin "+")
  inviterName: string | null;
  scopeLabel: string;
  roleLabel: string;
  token: string;       // se pone en el botón URL dinámico
  expiresAt: string;   // ISO
};

const KAPSO_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0";

const formatPhone = (raw: string): string => {
  let p = raw.trim();
  if (p.startsWith("whatsapp:")) p = p.slice("whatsapp:".length);
  if (p.startsWith("+")) p = p.slice(1);
  return p.replace(/\D/g, "");
};

const formatExpiresIn = (iso: string): string => {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return "menos de 1 día";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "1 día" : `${days} días`;
};

export class InviteWhatsAppSender {
  /** Devuelve true si se envió. False = no-op (faltan envs / error). */
  async send(input: InviteWhatsAppInput): Promise<boolean> {
    const apiKey = process.env.KAPSO_API_KEY;
    const phoneNumberId =
      process.env.KAPSO_WA_PHONE_NUMBER_ID ?? process.env.KAPSO_WA_NUMBER_ID;
    const templateName = process.env.KAPSO_WA_INVITE_TEMPLATE_NAME ?? "team_invitation";
    const templateLang = process.env.KAPSO_WA_INVITE_TEMPLATE_LANG ?? "es";

    if (!apiKey || !phoneNumberId) {
      console.warn("[InviteWhatsAppSender] Faltan KAPSO_API_KEY / KAPSO_WA_PHONE_NUMBER_ID — skip");
      return false;
    }

    try {
      const res = await fetch(`${KAPSO_BASE}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formatPhone(input.to),
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", parameter_name: "inviter_name", text: input.inviterName?.trim() || "Tu invitador" },
                  { type: "text", parameter_name: "scope_label", text: input.scopeLabel },
                  { type: "text", parameter_name: "role_label", text: input.roleLabel },
                  { type: "text", parameter_name: "expires_in", text: formatExpiresIn(input.expiresAt) },
                ],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: input.token }],
              },
            ],
          },
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`kapso ${res.status}: ${errText.slice(0, 200)}`);
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[InviteWhatsAppSender] envío falló:", message);
      return false;
    }
  }
}

export const inviteWhatsAppSender = new InviteWhatsAppSender();

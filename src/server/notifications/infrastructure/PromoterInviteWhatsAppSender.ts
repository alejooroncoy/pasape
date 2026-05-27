// Envía invitación al promotor por WhatsApp via Kapso Meta Proxy.
//
// === Template requerido (registrado vía Kapso CLI, esperar aprobación Meta) ===
//
//   Nombre:   promoter_invite_v4    (override KAPSO_WA_PROMOTER_TEMPLATE_NAME)
//   Idioma:   es                    (override KAPSO_WA_PROMOTER_TEMPLATE_LANG)
//   Tipo:     UTILITY
//
//   BODY:
//     "Hola {{promoter_name}}, {{org_name}} te agregó como promotor de
//      {{event_title}}. Activa tu acceso en {{claim_url}} y abre tu panel."
//   FOOTER: "Pasape"
//
// Notas Meta:
//   · v1 (con "Ganás X% comisión") fue recategorizado a MARKETING y rechazado.
//   · v2, v3 con botón URL: Meta rechaza botones URL salvo dominios verificados;
//     pasape.lat aún no está enlazado al WABA. Por eso pasamos la URL completa
//     inline como variable {{claim_url}} — mismo patrón que ticket_delivery.
//
// Magic-link sin OTP: el token en sí es la prueba de posesión del canal
// WhatsApp (el organizador tipeó el número, lo validamos al delivery).

type PromoterInviteInput = {
  to: string; // phone E.164 (con o sin "+")
  promoterName: string;
  orgName: string;
  eventTitle: string;
  claimToken: string;
};

const KAPSO_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0";
const DEFAULT_CLAIM_BASE =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "https://app.pasape.lat";

const formatPhone = (raw: string): string => {
  let p = raw.trim();
  if (p.startsWith("whatsapp:")) p = p.slice("whatsapp:".length);
  if (p.startsWith("+")) p = p.slice(1);
  return p.replace(/\D/g, "");
};

export class PromoterInviteWhatsAppSender {
  /** Devuelve true si se envió. False = no-op (envs faltantes o error). */
  async send(input: PromoterInviteInput): Promise<boolean> {
    const apiKey = process.env.KAPSO_API_KEY;
    const phoneNumberId =
      process.env.KAPSO_WA_PHONE_NUMBER_ID ?? process.env.KAPSO_WA_NUMBER_ID;
    const templateName =
      process.env.KAPSO_WA_PROMOTER_TEMPLATE_NAME ?? "promoter_invite_v4";
    const templateLang =
      process.env.KAPSO_WA_PROMOTER_TEMPLATE_LANG ?? "es";

    if (!apiKey || !phoneNumberId) {
      console.warn(
        "[PromoterInviteWhatsAppSender] Faltan KAPSO_API_KEY / KAPSO_WA_PHONE_NUMBER_ID — skip",
      );
      return false;
    }

    const claimUrl = `${DEFAULT_CLAIM_BASE}/es/c/${input.claimToken}`;

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
                  {
                    type: "text",
                    parameter_name: "promoter_name",
                    text: input.promoterName.trim() || "Promotor",
                  },
                  {
                    type: "text",
                    parameter_name: "org_name",
                    text: input.orgName.trim() || "Tu marca",
                  },
                  {
                    type: "text",
                    parameter_name: "event_title",
                    text: input.eventTitle.trim() || "tu evento",
                  },
                  {
                    type: "text",
                    parameter_name: "claim_url",
                    text: claimUrl,
                  },
                ],
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
      console.error("[PromoterInviteWhatsAppSender] envío falló:", message);
      return false;
    }
  }
}

export const promoterInviteWhatsAppSender = new PromoterInviteWhatsAppSender();

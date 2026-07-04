// Envía la invitación al promotor por WhatsApp. El transporte (Kapso/Meta) lo
// resuelve el WhatsAppGateway; este sender solo arma el template.
//
// === Template requerido (registrar/aprobar en el dashboard del proveedor) ===
//
//   Nombre:   promoter_invite_v4    (override WA_PROMOTER_TEMPLATE_NAME)
//   Idioma:   es                    (override WA_PROMOTER_TEMPLATE_LANG)
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

import { whatsAppGateway } from "./whatsapp";
import { bodyComponent } from "./whatsapp/components";

type PromoterInviteInput = {
  to: string; // phone E.164 (con o sin "+")
  promoterName: string;
  orgName: string;
  eventTitle: string;
  claimToken: string;
};

const DEFAULT_CLAIM_BASE =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "https://app.pasape.lat";

export class PromoterInviteWhatsAppSender {
  /** Devuelve true si se envió. False = no-op (proveedor sin configurar o error). */
  async send(input: PromoterInviteInput): Promise<boolean> {
    const gateway = whatsAppGateway();
    const templateName =
      process.env.WA_PROMOTER_TEMPLATE_NAME ??
      process.env.KAPSO_WA_PROMOTER_TEMPLATE_NAME ??
      "promoter_invite_v4";
    const templateLang =
      process.env.WA_PROMOTER_TEMPLATE_LANG ??
      process.env.KAPSO_WA_PROMOTER_TEMPLATE_LANG ??
      "es";

    if (!gateway.configured()) {
      console.warn("[PromoterInviteWhatsAppSender] proveedor de WhatsApp sin configurar — skip");
      return false;
    }

    const claimUrl = `${DEFAULT_CLAIM_BASE}/es/c/${input.claimToken}`;

    try {
      await gateway.sendTemplate({
        to: input.to,
        templateName,
        languageCode: templateLang,
        components: [
          bodyComponent({
            promoter_name: input.promoterName.trim() || "Promotor",
            org_name: input.orgName.trim() || "Tu marca",
            event_title: input.eventTitle.trim() || "tu evento",
            claim_url: claimUrl,
          }),
        ],
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[PromoterInviteWhatsAppSender] envío falló:", message);
      return false;
    }
  }
}

export const promoterInviteWhatsAppSender = new PromoterInviteWhatsAppSender();

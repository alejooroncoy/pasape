// Envía la invitación al promotor por WhatsApp. El transporte (Kapso/Meta) lo
// resuelve el WhatsAppGateway; este sender solo arma el template.
//
// === Template requerido (registrar/aprobar en el dashboard del proveedor) ===
//
//   Nombre:   promoter_invite_v15   (override WA_PROMOTER_TEMPLATE_NAME)
//   Idioma:   es                    (override WA_PROMOTER_TEMPLATE_LANG)
//   Tipo:     UTILITY  ·  parameter_format: NAMED
//
//   BODY:
//     "Hola {{promoter_name}} 👋\n\nLa marca {{org_name}} te sumó como promotor
//      para el evento {{event_title}}. 🎉\n\nToca el botón para activar tu
//      acceso y abrir tu panel."
//   FOOTER: "Pasape"
//   BOTÓN URL: "Activar mi acceso" → https://pasape.lat/es/c/{{1}}  ({{1}} = token)
//
// Notas Meta (histórico de rechazos, ya resuelto):
//   · v1 (con "Ganás X% comisión") fue recategorizado a MARKETING y rechazado.
//   · v2..v14 salían INVALID_FORMAT por 3 motivos de FORMATO (no de contenido):
//     parameter_format POSITIONAL con variables nombradas, variables adosadas
//     (sin texto entre ellas) y variable al final del body. v15 los corrige y
//     usa botón URL (los botones a pasape.lat sí se aprueban en este WABA).
//
// Magic-link sin OTP: el token en sí es la prueba de posesión del canal
// WhatsApp (el organizador tipeó el número, lo validamos al delivery). El botón
// del template ya trae la base https://pasape.lat/es/c/ — solo pasamos el token.

import { whatsAppGateway } from "./whatsapp";
import { bodyComponent, urlButtonComponent } from "./whatsapp/components";

type PromoterInviteInput = {
  to: string; // phone E.164 (con o sin "+")
  promoterName: string;
  orgName: string;
  eventTitle: string;
  claimToken: string;
};

export class PromoterInviteWhatsAppSender {
  /** Devuelve true si se envió. False = no-op (proveedor sin configurar o error). */
  async send(input: PromoterInviteInput): Promise<boolean> {
    const gateway = whatsAppGateway();
    const templateName =
      process.env.WA_PROMOTER_TEMPLATE_NAME ??
      process.env.KAPSO_WA_PROMOTER_TEMPLATE_NAME ??
      "promoter_invite_v15";
    const templateLang =
      process.env.WA_PROMOTER_TEMPLATE_LANG ??
      process.env.KAPSO_WA_PROMOTER_TEMPLATE_LANG ??
      "es";

    if (!gateway.configured()) {
      console.warn("[PromoterInviteWhatsAppSender] proveedor de WhatsApp sin configurar — skip");
      return false;
    }

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
          }),
          // El botón del template apunta a https://pasape.lat/es/c/{{1}} → solo el token.
          urlButtonComponent(input.claimToken),
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

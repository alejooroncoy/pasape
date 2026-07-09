// Avisa al promotor por WhatsApp cuando el organizador aprueba su solicitud.
// El transporte (Kapso/Meta) lo resuelve el WhatsAppGateway; este sender solo
// arma el template.
//
// === Template requerido (registrar/aprobar en el dashboard del proveedor) ===
//
//   Nombre:   promoter_approved_v2   (override WA_PROMOTER_APPROVED_TEMPLATE_NAME)
//   Idioma:   es                     (override WA_PROMOTER_APPROVED_TEMPLATE_LANG)
//   Tipo:     UTILITY  ·  parameter_format: NAMED
//
//   BODY:
//     "Hola {{promoter_name}}, tu solicitud como promotor de {{event_title}} fue
//      aprobada por {{org_name}}. Ingresa a tu panel para ver los detalles."
//   FOOTER: "Pasape"
//   BOTÓN URL (estático): "Abrir mi panel" → https://pasape.lat/es/promo
//
// v1 quedó descartado: Meta lo reclasificó de UTILITY a MARKETING por el tono
// promocional ("Ya puedes vender y ganar tu comisión... copiar tu link de
// venta"). v2 usa tono puramente informacional (aviso de estado, sin incentivo
// de venta) — mismo patrón que los templates UTILITY ya aprobados en la cuenta
// (event_cancelled_v7, ticket_transferred_in_v7).
//
// Notas de FORMATO Meta (heredadas de promoter_invite_v15, para no repetir
// rechazos INVALID_FORMAT):
//   · parameter_format NAMED con variables nombradas (no POSITIONAL).
//   · sin variables adosadas (siempre texto entre ellas) y ninguna al final del
//     body — por eso el body cierra con "...ver los detalles.".
//   · botón URL ESTÁTICO a pasape.lat (no lleva variable) → no se pasa
//     urlButtonComponent, solo el body.

import { whatsAppGateway } from "./whatsapp";
import { bodyComponent } from "./whatsapp/components";

type PromoterApprovedInput = {
  to: string; // phone E.164 (con o sin "+")
  promoterName: string;
  orgName: string;
  eventTitle: string;
};

export class PromoterApprovedWhatsAppSender {
  /** Devuelve true si se envió. False = no-op (proveedor sin configurar o error). */
  async send(input: PromoterApprovedInput): Promise<boolean> {
    const gateway = whatsAppGateway();
    const templateName =
      process.env.WA_PROMOTER_APPROVED_TEMPLATE_NAME ??
      process.env.KAPSO_WA_PROMOTER_APPROVED_TEMPLATE_NAME ??
      "promoter_approved_v2";
    const templateLang =
      process.env.WA_PROMOTER_APPROVED_TEMPLATE_LANG ??
      process.env.KAPSO_WA_PROMOTER_APPROVED_TEMPLATE_LANG ??
      "es";

    if (!gateway.configured()) {
      console.warn("[PromoterApprovedWhatsAppSender] proveedor de WhatsApp sin configurar — skip");
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
        ],
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[PromoterApprovedWhatsAppSender] envío falló:", message);
      return false;
    }
  }
}

export const promoterApprovedWhatsAppSender = new PromoterApprovedWhatsAppSender();

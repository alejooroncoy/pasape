import type {
  NotificationSender,
  TicketDeliveryInput,
  TicketDeliveryResult,
} from "../ports/NotificationSender";
import type { WhatsAppGateway } from "../ports/WhatsAppGateway";
import { whatsAppGateway } from "./whatsapp";
import { bodyComponent, urlButtonComponent } from "./whatsapp/components";
import { humanizeName } from "../humanizeName";

// Envía el QR del ticket (y avisos de transferencia) por WhatsApp. YA NO conoce
// al proveedor: delega el transporte en un WhatsAppGateway (Kapso o Meta), que
// se elige por env. Este sender solo sabe QUÉ template usar y cómo mapear los
// datos a los parámetros del cuerpo.
//
// Los nombres de template son de Meta (iguales sea cual sea el proveedor), así
// que leemos primero las envs neutrales WA_* y caemos a las KAPSO_WA_* legacy
// para no romper la config actual.

// Template v2 (con botón de URL). Env dedicada, independiente de la vieja
// WA_TEMPLATE_NAME/KAPSO_WA_TEMPLATE_NAME (que apuntaban al template SIN botón):
// un valor viejo en prod chocaría con el nuevo shape (body sin ticket_url +
// componente de botón). Por eso su propio default.
const templateName = (): string =>
  process.env.WA_TEMPLATE_NAME_V2 ??
  process.env.KAPSO_WA_TEMPLATE_NAME_V2 ??
  "ticket_delivery_v2";

// Cuando la orden tiene >1 ticket agrupado en un mismo envío (ver
// DispatchTicketDelivery), usamos un template con variable de cantidad —
// pendiente de aprobación en Meta al momento de escribir esto. Mientras no
// esté aprobado, sendTicketDelivery cae al template singular de siempre (un
// solo envío igual, solo que el copy no menciona el número todavía).
const multiTemplateName = (): string =>
  process.env.WA_TEMPLATE_NAME_MULTI ??
  process.env.KAPSO_WA_TEMPLATE_NAME_MULTI ??
  "ticket_delivery_multi_v1";

const templateLang = (): string =>
  process.env.WA_TEMPLATE_LANG ?? process.env.KAPSO_WA_TEMPLATE_LANG ?? "es";

const claimTemplateName = (): string =>
  process.env.WA_CLAIM_TEMPLATE_NAME ??
  process.env.KAPSO_WA_CLAIM_TEMPLATE_NAME ??
  "ticket_claim_invite_v1";

const claimFallbackTemplateName = (): string =>
  process.env.WA_CLAIM_FALLBACK_TEMPLATE_NAME ??
  process.env.KAPSO_WA_CLAIM_FALLBACK_TEMPLATE_NAME ??
  "ticket_transferred_in_v7";

// Versiones con botón de URL (más práctico que el link como texto plano en el
// cuerpo, y el cuerpo queda mejor espaciado) — pendientes de aprobación en
// Meta al momento de escribir esto. Mientras no aprueben, sendTransferClaim
// cae a las plantillas *_v1/*_v7 de siempre (mismo link, sin botón).
const claimButtonTemplateName = (): string =>
  process.env.WA_CLAIM_TEMPLATE_NAME_V2 ??
  process.env.KAPSO_WA_CLAIM_TEMPLATE_NAME_V2 ??
  "ticket_claim_invite_v2";

const claimFallbackButtonTemplateName = (): string =>
  process.env.WA_CLAIM_FALLBACK_TEMPLATE_NAME_V2 ??
  process.env.KAPSO_WA_CLAIM_FALLBACK_TEMPLATE_NAME_V2 ??
  "ticket_transferred_in_v8";

const paymentReviewTemplateName = (): string =>
  process.env.WA_PAYMENT_REVIEW_TEMPLATE_NAME ?? "payment_in_review_v1";

const paymentRejectedTemplateName = (): string =>
  process.env.WA_PAYMENT_REJECTED_TEMPLATE_NAME ?? "payment_rejected_v1";

const formatDateForTemplate = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Lima",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export class WhatsAppNotificationSender implements NotificationSender {
  constructor(private readonly gateway: WhatsAppGateway = whatsAppGateway()) {}

  // Aviso de transferencia: a un número (con o sin cuenta) le llega el link de
  // reclamo. Usa un template propio (ticket_claim_invite) que NO depende del
  // nombre del receptor — solo el del emisor.
  async sendTransferClaim(input: {
    phone: string;
    senderName: string;
    eventTitle: string;
    eventStartsAt: string;
    claimUrl: string;
  }): Promise<boolean> {
    const lang = templateLang();
    const startsAt = formatDateForTemplate(input.eventStartsAt);
    // El botón de las versiones _v2/_v8 apunta a `https://pasape.lat/es/claim/{{1}}`,
    // así que el parámetro es el sufijo tras "/es/claim/" (el token).
    const buttonUrlSuffix = input.claimUrl.split("/es/claim/")[1] ?? input.claimUrl;

    // 1a) Botón de URL (más práctico que el link en texto plano) — pendiente
    // de aprobación en Meta al momento de escribir esto.
    try {
      await this.gateway.sendTemplate({
        to: input.phone,
        templateName: claimButtonTemplateName(),
        languageCode: lang,
        components: [
          bodyComponent({
            sender_name: input.senderName,
            event_title: input.eventTitle,
            event_starts_at: startsAt,
          }),
          urlButtonComponent(buttonUrlSuffix),
        ],
      });
      return true;
    } catch (err) {
      console.warn(
        "[WhatsAppNotificationSender] claim template con botón falló, uso el de siempre:",
        err,
      );
    }

    // 1b) Template propio de siempre (sin nombre del receptor, link en texto).
    try {
      await this.gateway.sendTemplate({
        to: input.phone,
        templateName: claimTemplateName(),
        languageCode: lang,
        components: [
          bodyComponent({
            sender_name: input.senderName,
            event_title: input.eventTitle,
            event_starts_at: startsAt,
            claim_url: input.claimUrl,
          }),
        ],
      });
      return true;
    } catch (err) {
      // Aún no aprobado (o error): caemos al template aprobado de "transferencia
      // recibida". No conocemos el nombre del receptor → saludo neutro.
      console.warn("[WhatsAppNotificationSender] claim template falló, uso fallback:", err);
    }

    // 2a) Fallback con botón.
    try {
      await this.gateway.sendTemplate({
        to: input.phone,
        templateName: claimFallbackButtonTemplateName(),
        languageCode: lang,
        components: [
          bodyComponent({
            holder_name: "👋",
            sender_name: input.senderName,
            event_title: input.eventTitle,
            event_starts_at: startsAt,
          }),
          urlButtonComponent(buttonUrlSuffix),
        ],
      });
      return true;
    } catch (err) {
      console.warn(
        "[WhatsAppNotificationSender] fallback con botón falló, uso el de siempre:",
        err,
      );
    }

    // 2b) Fallback de siempre (link en texto).
    try {
      await this.gateway.sendTemplate({
        to: input.phone,
        templateName: claimFallbackTemplateName(),
        languageCode: lang,
        components: [
          bodyComponent({
            holder_name: "👋",
            sender_name: input.senderName,
            event_title: input.eventTitle,
            event_starts_at: startsAt,
            ticket_url: input.claimUrl,
          }),
        ],
      });
      return true;
    } catch (err) {
      console.error("[WhatsAppNotificationSender] aviso de transferencia falló:", err);
      return false;
    }
  }

  // Aviso de estado de pago: "en revisión" (in_process) o "rechazado". Usa una
  // plantilla por caso (aprobadas en Meta). El link de reintento va como param
  // del cuerpo. Best-effort: si la plantilla no está aprobada aún, devuelve false
  // y el correo (que sí funciona) cubre el aviso.
  // `retryPath` es el suffix que va en el botón URL de la plantilla (la URL base
  // https://app.pasape.lat/ está fija en Meta; el botón concatena este valor).
  async sendPaymentReview(input: {
    phone: string;
    kind: "in_review" | "rejected";
    holderName: string;
    eventTitle: string;
    retryPath: string;
  }): Promise<boolean> {
    const name =
      input.kind === "rejected" ? paymentRejectedTemplateName() : paymentReviewTemplateName();
    if (!this.gateway.configured() || !name || !input.phone) return false;
    try {
      await this.gateway.sendTemplate({
        to: input.phone,
        templateName: name,
        languageCode: templateLang(),
        components: [
          bodyComponent({
            holder_name: input.holderName,
            event_title: input.eventTitle,
          }),
          urlButtonComponent(input.retryPath),
        ],
      });
      return true;
    } catch (err) {
      console.warn("[WhatsAppNotificationSender] aviso de pago falló (plantilla no aprobada?):", err);
      return false;
    }
  }

  async sendTicketDelivery(input: TicketDeliveryInput): Promise<TicketDeliveryResult> {
    if (!this.gateway.configured()) {
      console.warn(
        "[WhatsAppNotificationSender] proveedor de WhatsApp sin configurar — skip WhatsApp",
      );
      return { emailSent: false, whatsappSent: false };
    }
    if (!input.to.phone) {
      return { emailSent: false, whatsappSent: false };
    }

    // El botón dinámico del template v2 apunta a `https://pasape.lat/order/{{1}}`,
    // así que el parámetro es el sufijo tras "/order/" ("<orderId>/<firma>").
    const buttonUrlSuffix = input.ticketUrl.split("/order/")[1] ?? input.ticketUrl;

    if (input.ticketCount > 1) {
      try {
        await this.gateway.sendTemplate({
          to: input.to.phone,
          templateName: multiTemplateName(),
          languageCode: templateLang(),
          components: [
            bodyComponent({
              holder_name: humanizeName(input.holderName),
              ticket_count: String(input.ticketCount),
              event_title: input.eventTitle,
              event_starts_at: formatDateForTemplate(input.eventStartsAt),
            }),
            urlButtonComponent(buttonUrlSuffix),
          ],
        });
        return { emailSent: false, whatsappSent: true };
      } catch (err) {
        // Probable "template no aprobado aún" (ver ticket_delivery_multi_v1,
        // pendiente en Meta) — cae al template singular de siempre. Sigue
        // siendo UN solo envío, solo que el copy no menciona el número.
        console.warn(
          "[WhatsAppNotificationSender] template multi falló, uso singular:",
          err,
        );
      }
    }

    try {
      await this.gateway.sendTemplate({
        to: input.to.phone,
        templateName: templateName(),
        languageCode: templateLang(),
        components: [
          bodyComponent({
            holder_name: humanizeName(input.holderName),
            event_title: input.eventTitle,
            event_starts_at: formatDateForTemplate(input.eventStartsAt),
          }),
          urlButtonComponent(buttonUrlSuffix),
        ],
      });
      return { emailSent: false, whatsappSent: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[WhatsAppNotificationSender] envío falló:", message);
      return {
        emailSent: false,
        whatsappSent: false,
        errors: [{ channel: "whatsapp", message }],
      };
    }
  }
}

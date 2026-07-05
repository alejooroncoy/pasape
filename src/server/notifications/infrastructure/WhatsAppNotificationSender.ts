import type {
  NotificationSender,
  TicketDeliveryInput,
  TicketDeliveryResult,
} from "../ports/NotificationSender";
import type { WhatsAppGateway } from "../ports/WhatsAppGateway";
import { whatsAppGateway } from "./whatsapp";
import { bodyComponent } from "./whatsapp/components";

// Envía el QR del ticket (y avisos de transferencia) por WhatsApp. YA NO conoce
// al proveedor: delega el transporte en un WhatsAppGateway (Kapso o Meta), que
// se elige por env. Este sender solo sabe QUÉ template usar y cómo mapear los
// datos a los parámetros del cuerpo.
//
// Los nombres de template son de Meta (iguales sea cual sea el proveedor), así
// que leemos primero las envs neutrales WA_* y caemos a las KAPSO_WA_* legacy
// para no romper la config actual.

const templateName = (): string | undefined =>
  process.env.WA_TEMPLATE_NAME ?? process.env.KAPSO_WA_TEMPLATE_NAME;

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

    // 1) Template propio (sin nombre del receptor, lenguaje de "reclamo").
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
  async sendPaymentReview(input: {
    phone: string;
    kind: "in_review" | "rejected";
    holderName: string;
    eventTitle: string;
    retryUrl: string;
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
            retry_url: input.retryUrl,
          }),
        ],
      });
      return true;
    } catch (err) {
      console.warn("[WhatsAppNotificationSender] aviso de pago falló (plantilla no aprobada?):", err);
      return false;
    }
  }

  async sendTicketDelivery(input: TicketDeliveryInput): Promise<TicketDeliveryResult> {
    const name = templateName();
    if (!this.gateway.configured() || !name) {
      console.warn(
        "[WhatsAppNotificationSender] proveedor sin configurar o falta WA_TEMPLATE_NAME — skip WhatsApp",
      );
      return { emailSent: false, whatsappSent: false };
    }
    if (!input.to.phone) {
      return { emailSent: false, whatsappSent: false };
    }

    try {
      await this.gateway.sendTemplate({
        to: input.to.phone,
        templateName: name,
        languageCode: templateLang(),
        components: [
          bodyComponent({
            holder_name: input.holderName,
            event_title: input.eventTitle,
            event_starts_at: formatDateForTemplate(input.eventStartsAt),
            ticket_url: input.ticketUrl,
          }),
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

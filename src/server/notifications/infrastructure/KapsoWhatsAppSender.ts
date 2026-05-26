import type {
  NotificationSender,
  TicketDeliveryInput,
  TicketDeliveryResult,
} from "../ports/NotificationSender";

// Adapter WhatsApp vía Kapso Meta Proxy API (https://api.kapso.ai/meta/whatsapp/v24.0).
// Env vars requeridas:
//   KAPSO_API_KEY            — project API key del dashboard (header X-API-Key)
//   KAPSO_WA_PHONE_NUMBER_ID — WhatsApp Phone Number ID (numérico de Meta)
//   KAPSO_WA_TEMPLATE_NAME   — nombre del template aprobado (ej. "ticket_delivery")
//   KAPSO_WA_TEMPLATE_LANG   — idioma del template (ej. "es" o "es_PE")
//
// El template usa NAMED parameters: holder_name, event_title, event_starts_at, ticket_url.
// Meta exige que las variables NO estén al principio ni al final del cuerpo.
//
// Si faltan env vars degrada a no-op + warn (no rompe el checkout).

const formatPhone = (raw: string): string => {
  const trimmed = raw.trim();
  // Meta API espera E.164 sin "+" ni "whatsapp:" prefix.
  let p = trimmed.startsWith("whatsapp:") ? trimmed.slice("whatsapp:".length) : trimmed;
  if (p.startsWith("+")) p = p.slice(1);
  return p.replace(/\D/g, "");
};

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

const KAPSO_BASE = "https://api.kapso.ai/meta/whatsapp/v24.0";

export class KapsoWhatsAppSender implements NotificationSender {
  async sendTicketDelivery(input: TicketDeliveryInput): Promise<TicketDeliveryResult> {
    const apiKey = process.env.KAPSO_API_KEY;
    // Why: aceptamos tanto el nombre nuevo (PHONE_NUMBER_ID) como el alias antiguo
    // (NUMBER_ID) durante la transición.
    const phoneNumberId =
      process.env.KAPSO_WA_PHONE_NUMBER_ID ?? process.env.KAPSO_WA_NUMBER_ID;
    const templateName = process.env.KAPSO_WA_TEMPLATE_NAME;
    const templateLang = process.env.KAPSO_WA_TEMPLATE_LANG ?? "es";
    if (!apiKey || !phoneNumberId || !templateName) {
      console.warn(
        "[KapsoWhatsAppSender] Faltan KAPSO_API_KEY/KAPSO_WA_PHONE_NUMBER_ID/KAPSO_WA_TEMPLATE_NAME — skip WhatsApp",
      );
      return { emailSent: false, whatsappSent: false };
    }
    if (!input.to.phone) {
      return { emailSent: false, whatsappSent: false };
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
          to: formatPhone(input.to.phone),
          type: "template",
          template: {
            name: templateName,
            language: { code: templateLang },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", parameter_name: "holder_name", text: input.holderName },
                  { type: "text", parameter_name: "event_title", text: input.eventTitle },
                  {
                    type: "text",
                    parameter_name: "event_starts_at",
                    text: formatDateForTemplate(input.eventStartsAt),
                  },
                  { type: "text", parameter_name: "ticket_url", text: input.ticketUrl },
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
      return { emailSent: false, whatsappSent: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[KapsoWhatsAppSender] envío falló:", message);
      return {
        emailSent: false,
        whatsappSent: false,
        errors: [{ channel: "whatsapp", message }],
      };
    }
  }
}

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

type NamedParam = { name: string; text: string };

// Envía un template NAMED por el proxy Meta de Kapso. Devuelve true si Meta lo
// aceptó. Si faltan credenciales o el teléfono, degrada a false sin romper.
const sendNamedTemplate = async (
  phone: string,
  templateName: string,
  templateLang: string,
  params: NamedParam[],
): Promise<boolean> => {
  const apiKey = process.env.KAPSO_API_KEY;
  const phoneNumberId =
    process.env.KAPSO_WA_PHONE_NUMBER_ID ?? process.env.KAPSO_WA_NUMBER_ID;
  if (!apiKey || !phoneNumberId || !templateName) {
    console.warn("[KapsoWhatsAppSender] Faltan credenciales/template — skip WhatsApp");
    return false;
  }
  const res = await fetch(`${KAPSO_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formatPhone(phone),
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: "body",
            parameters: params.map((p) => ({
              type: "text",
              parameter_name: p.name,
              text: p.text,
            })),
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
};

export class KapsoWhatsAppSender implements NotificationSender {
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
    const templateName =
      process.env.KAPSO_WA_CLAIM_TEMPLATE_NAME ?? "ticket_claim_invite_v1";
    const templateLang = process.env.KAPSO_WA_TEMPLATE_LANG ?? "es";
    const startsAt = formatDateForTemplate(input.eventStartsAt);

    // 1) Template propio (sin nombre del receptor, lenguaje de "reclamo").
    try {
      return await sendNamedTemplate(input.phone, templateName, templateLang, [
        { name: "sender_name", text: input.senderName },
        { name: "event_title", text: input.eventTitle },
        { name: "event_starts_at", text: startsAt },
        { name: "claim_url", text: input.claimUrl },
      ]);
    } catch (err) {
      // Aún no aprobado (o error): caemos al template aprobado de "transferencia
      // recibida". No conocemos el nombre del receptor → saludo neutro.
      console.warn("[KapsoWhatsAppSender] claim template falló, uso fallback:", err);
    }

    const fallbackName =
      process.env.KAPSO_WA_CLAIM_FALLBACK_TEMPLATE_NAME ?? "ticket_transferred_in_v7";
    try {
      return await sendNamedTemplate(input.phone, fallbackName, templateLang, [
        { name: "holder_name", text: "👋" },
        { name: "sender_name", text: input.senderName },
        { name: "event_title", text: input.eventTitle },
        { name: "event_starts_at", text: startsAt },
        { name: "ticket_url", text: input.claimUrl },
      ]);
    } catch (err) {
      console.error("[KapsoWhatsAppSender] aviso de transferencia falló:", err);
      return false;
    }
  }

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

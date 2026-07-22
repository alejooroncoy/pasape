import type { SendTemplateInput, WhatsAppGateway } from "../../ports/WhatsAppGateway";
import { formatWhatsAppPhone } from "./phone";

// Base común de los gateways HTTP (Kapso y Meta hablan el mismo endpoint
// `{base}/{phoneNumberId}/messages` con el mismo body). Cada proveedor solo
// aporta su URL base, su Phone Number ID y su header de auth — el armado del
// payload y el manejo de error viven aquí, una sola vez.
export abstract class HttpWhatsAppGateway implements WhatsAppGateway {
  abstract readonly providerName: string;

  protected abstract baseUrl(): string | null;
  protected abstract phoneNumberId(): string | null;
  protected abstract authHeaders(): Record<string, string> | null;

  configured(): boolean {
    return Boolean(this.baseUrl() && this.phoneNumberId() && this.authHeaders());
  }

  async sendTemplate(input: SendTemplateInput): Promise<void> {
    const base = this.baseUrl();
    const phoneNumberId = this.phoneNumberId();
    const auth = this.authHeaders();
    if (!base || !phoneNumberId || !auth) {
      throw new Error(`${this.providerName}: proveedor sin configurar (faltan credenciales)`);
    }

    const res = await fetch(`${base}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formatWhatsAppPhone(input.to),
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.languageCode },
          components: input.components,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      // Formato "<provider> <status>: <body>" — así queda greppable en
      // notification_dispatches.error (p.ej. "kapso 401: ...", "meta 190: ...").
      throw new Error(`${this.providerName} ${res.status}: ${errText.slice(0, 200)}`);
    }
  }

  // Mensaje de texto libre — válido solo dentro de la ventana de 24h desde el
  // último mensaje del usuario (Meta no lo entrega fuera de esa ventana, a
  // diferencia de sendTemplate). Úsalo para responder una conversación que el
  // usuario ya inició, nunca para contactar en frío.
  async sendText(input: { to: string; body: string }): Promise<void> {
    const base = this.baseUrl();
    const phoneNumberId = this.phoneNumberId();
    const auth = this.authHeaders();
    if (!base || !phoneNumberId || !auth) {
      throw new Error(`${this.providerName}: proveedor sin configurar (faltan credenciales)`);
    }

    const res = await fetch(`${base}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formatWhatsAppPhone(input.to),
        type: "text",
        text: { body: input.body },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`${this.providerName} ${res.status}: ${errText.slice(0, 200)}`);
    }
  }
}

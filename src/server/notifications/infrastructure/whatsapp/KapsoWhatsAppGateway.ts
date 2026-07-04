import { HttpWhatsAppGateway } from "./HttpWhatsAppGateway";

// Proveedor Kapso (proxy Meta): https://api.kapso.ai/meta/whatsapp/v24.0
// Envs:
//   KAPSO_API_KEY            — project API key (header X-API-Key)
//   KAPSO_WA_PHONE_NUMBER_ID — WhatsApp Phone Number ID (numérico de Meta)
export class KapsoWhatsAppGateway extends HttpWhatsAppGateway {
  readonly providerName = "kapso";

  protected baseUrl(): string {
    return "https://api.kapso.ai/meta/whatsapp/v24.0";
  }

  protected phoneNumberId(): string | null {
    // Aceptamos el alias antiguo NUMBER_ID durante la transición.
    return process.env.KAPSO_WA_PHONE_NUMBER_ID ?? process.env.KAPSO_WA_NUMBER_ID ?? null;
  }

  protected authHeaders(): Record<string, string> | null {
    const key = process.env.KAPSO_API_KEY;
    return key ? { "X-API-Key": key } : null;
  }
}

import { HttpWhatsAppGateway } from "./HttpWhatsAppGateway";

// Proveedor Meta directo (Cloud API, sin proxy): https://graph.facebook.com/v24.0
// Envs:
//   META_WHATSAPP_TOKEN      — token del System User del WABA (Bearer). Debe ser
//                              PERMANENTE (no el temporal de 24h): si expira,
//                              vuelve el 401 que tumbó a Kapso.
//                              (alias aceptado: META_WA_ACCESS_TOKEN)
//   META_WA_PHONE_NUMBER_ID  — Phone Number ID de Meta. Es EL MISMO que usa
//                              Kapso, así que por defecto reutilizamos
//                              KAPSO_WA_PHONE_NUMBER_ID.
//   META_WA_GRAPH_VERSION    — opcional, default "v24.0"
export class MetaWhatsAppGateway extends HttpWhatsAppGateway {
  readonly providerName = "meta";

  protected baseUrl(): string {
    const version = process.env.META_WA_GRAPH_VERSION ?? "v24.0";
    return `https://graph.facebook.com/${version}`;
  }

  protected phoneNumberId(): string | null {
    // El Phone Number ID es de Meta (Kapso solo lo proxea) → el mismo valor sirve
    // para ambos proveedores; reutilizamos el de Kapso si no hay uno propio.
    return (
      process.env.META_WA_PHONE_NUMBER_ID ??
      process.env.KAPSO_WA_PHONE_NUMBER_ID ??
      process.env.KAPSO_WA_NUMBER_ID ??
      null
    );
  }

  protected authHeaders(): Record<string, string> | null {
    const token = process.env.META_WHATSAPP_TOKEN ?? process.env.META_WA_ACCESS_TOKEN;
    return token ? { Authorization: `Bearer ${token}` } : null;
  }
}

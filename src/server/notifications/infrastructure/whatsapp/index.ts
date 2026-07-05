import type { WhatsAppGateway } from "../../ports/WhatsAppGateway";
import { KapsoWhatsAppGateway } from "./KapsoWhatsAppGateway";
import { MetaWhatsAppGateway } from "./MetaWhatsAppGateway";

export { KapsoWhatsAppGateway } from "./KapsoWhatsAppGateway";
export { MetaWhatsAppGateway } from "./MetaWhatsAppGateway";
export { bodyComponent, urlButtonComponent } from "./components";

// Factory del transporte de WhatsApp. Cambiar de proveedor = cambiar UNA env var
// (WHATSAPP_PROVIDER), sin tocar ningún sender.
//   WHATSAPP_PROVIDER=meta   → Cloud API de Meta directo
//   WHATSAPP_PROVIDER=kapso  → proxy Kapso (default histórico)
export const whatsAppGateway = (): WhatsAppGateway => {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "kapso").toLowerCase();
  switch (provider) {
    case "meta":
      return new MetaWhatsAppGateway();
    case "kapso":
      return new KapsoWhatsAppGateway();
    default:
      console.warn(`[whatsAppGateway] proveedor desconocido "${provider}" — uso kapso`);
      return new KapsoWhatsAppGateway();
  }
};

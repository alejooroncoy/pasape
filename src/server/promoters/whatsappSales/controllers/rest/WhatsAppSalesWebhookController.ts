import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { whatsAppGateway } from "@/server/notifications/infrastructure/whatsapp";
import { formatWhatsAppPhone } from "@/server/notifications/infrastructure/whatsapp/phone";
import { handleIncomingWhatsAppMessage } from "../../application/HandleIncomingWhatsAppMessage";
import { supabaseWhatsAppSaleRepository } from "../../infrastructure/SupabaseWhatsAppSaleRepository";

// Shape del webhook entrante: Kapso es un proxy que habla el mismo dialecto
// que la Cloud API de Meta (ver notifications/ports/WhatsAppGateway.ts), así
// que el payload de "mensaje entrante" sigue el formato estándar de Meta
// Cloud API. SIN VERIFICAR contra la doc real de Kapso todavía — antes de
// activar en producción, confirmar el shape exacto con un webhook de prueba.
type MetaInboundPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

const resolvePromoterBySalesCode = async (
  code: string,
): Promise<{ id: string; name: string; phone: string } | null> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("org_promoters")
    .select("id, name, whatsapp")
    .eq("sales_code", code)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; name: string; whatsapp: string | null }>();
  if (!data || !data.whatsapp) return null;
  return { id: data.id, name: data.name, phone: formatWhatsAppPhone(data.whatsapp) };
};

export const WhatsAppSalesWebhookController = {
  // Nota deliberada: no hay verificación de firma todavía (KAPSO_WEBHOOK_SECRET
  // no existe aún) — bloqueante antes de exponer esta ruta en producción real,
  // ver docs/mvp-whatsapp-promotores-2026-07-21.md.
  async handleInbound(payload: MetaInboundPayload): Promise<void> {
    const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
    for (const m of messages) {
      if (!m.from || !m.text?.body) continue;
      await handleIncomingWhatsAppMessage(
        {
          saleRepo: supabaseWhatsAppSaleRepository,
          gateway: whatsAppGateway(),
          resolvePromoterBySalesCode,
        },
        { fromPhone: m.from, text: m.text.body },
      );
    }
  },
};

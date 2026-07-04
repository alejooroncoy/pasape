import "server-only";
import { MercadoPagoConfig } from "mercadopago";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Money } from "@/lib/_shared/money";

// Why: `env.mpAccessToken` returns "" si no está seteado para no romper
// `pnpm build`. Aquí validamos en runtime y dejamos un error claro.

const TIMEOUT_MS = 5_000;

/**
 * Builds a MercadoPagoConfig.
 *
 * When the seller organization has an `mp_account_id` (marketplace mode),
 * we still authenticate with the platform access token. Real OAuth-based
 * split payments require the seller's own access token and the
 * `marketplace`/`marketplace_fee` fields in the preference body; until we
 * onboard sellers via OAuth (F11), we operate in single-seller mode.
 */
export const mpClient = (opts?: { sellerAccessToken?: string | null }): MercadoPagoConfig => {
  const token = opts?.sellerAccessToken || process.env.MP_ACCESS_TOKEN || "";
  if (!token) {
    throw new Error(
      "missing_mp_access_token: set MP_ACCESS_TOKEN (or onboard the org via MP OAuth)",
    );
  }
  return new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: TIMEOUT_MS },
  });
};

export const mpWebhookSecret = (): string => {
  const s = process.env.MP_WEBHOOK_SECRET || "";
  if (!s) throw new Error("missing_mp_webhook_secret");
  return s;
};

export const appBaseUrl = (): string => {
  const explicit = process.env.APP_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (vercel) return vercel.startsWith("http") ? vercel.replace(/\/$/, "") : `https://${vercel}`;
  return "http://localhost:3000";
};

// MP rechaza `back_urls`/`notification_url` que no sean públicas (loopback,
// IPs de LAN, o http sin TLS) cuando `auto_return`/webhook están activos. Solo
// consideramos "pública" una URL https cuyo host no sea loopback ni una IP
// privada (192.168 / 10 / 172.16-31). En dev sin túnel → false → omitimos esos
// campos y el polling de status cubre la confirmación.
export const isPublicBaseUrl = (base: string = appBaseUrl()): boolean => {
  const isPrivateHost =
    /localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\/\/(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\./.test(
      base,
    );
  return base.startsWith("https://") && !isPrivateHost;
};

export type MpPaymentItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  category_id: string;
};

// Why: la "medición de calidad" de MP (checkout-api-payments/go-to-production-requirements)
// pondera enviar `additional_info.items` con el detalle real de la compra — mejora
// el approval rate y es requisito para llegar al puntaje recomendado (100/100,
// mínimo 73 para certificar). Los tickets ya existen al momento de cobrar (se
// crean en el "buy" antes del pago), así que agrupamos por ticket_type real.
export const buildOrderItems = async (
  db: SupabaseClient,
  orderId: string,
): Promise<MpPaymentItem[]> => {
  const { data: tickets } = await db
    .from("tickets")
    .select("ticket_type_id, price_cents")
    .eq("order_id", orderId);
  const rows = (tickets ?? []) as Array<{ ticket_type_id: string; price_cents: number | null }>;
  if (rows.length === 0) return [];

  const byType = new Map<string, { qty: number; totalCents: number }>();
  for (const t of rows) {
    const cur = byType.get(t.ticket_type_id) ?? { qty: 0, totalCents: 0 };
    cur.qty += 1;
    cur.totalCents += t.price_cents ?? 0;
    byType.set(t.ticket_type_id, cur);
  }

  const typeIds = [...byType.keys()];
  const { data: types } = await db.from("ticket_types").select("id, name").in("id", typeIds);
  const nameById = new Map(
    ((types ?? []) as Array<{ id: string; name: string }>).map((t) => [t.id, t.name]),
  );

  const items = typeIds.map((id) => {
    const { qty, totalCents } = byType.get(id)!;
    return {
      id,
      title: nameById.get(id) ?? "Entrada",
      quantity: qty,
      unit_price: Money.toSoles(Math.round(totalCents / qty)),
      category_id: "tickets",
    };
  });

  // La suma de items debe igualar transaction_amount (order.total_cents).
  // En buyer_pays_extra el fee se suma aparte y se desglosa como línea
  // informativa; en included_in_price ya está adentro del precio de cada
  // entrada, así que no se agrega una línea extra (sumaría de más).
  const { data: order } = await db
    .from("orders")
    .select("service_fee_cents, event_id")
    .eq("id", orderId)
    .maybeSingle<{ service_fee_cents: number | null; event_id: string }>();
  const serviceFeeCents = order?.service_fee_cents ?? 0;
  const { data: event } = order
    ? await db
        .from("events")
        .select("fee_mode")
        .eq("id", order.event_id)
        .maybeSingle<{ fee_mode: string }>()
    : { data: null };
  if (serviceFeeCents > 0 && event?.fee_mode !== "included_in_price") {
    items.push({
      id: "service_fee",
      title: "Servicio Pasape",
      quantity: 1,
      unit_price: Money.toSoles(serviceFeeCents),
      category_id: "service_fee",
    });
  }

  return items;
};

import "server-only";
import { MercadoPagoConfig, Payment, PaymentRefund } from "mercadopago";
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

// ── Operaciones sobre un pago existente ──────────────────────────────────────
// Se usan cuando un pago quedó en revisión (in_process) y el comprador reintenta
// con otro medio (cancelar el anterior antes de cobrar de nuevo), o cuando un
// pago viejo se cuela tras haber cobrado otro (reembolso backstop anti-doble-cobro).

export const getMpPayment = async (paymentId: string | number) => {
  return new Payment(mpClient()).get({ id: paymentId });
};

// Cancela un pago que aún NO se acreditó (pending/in_process); libera la
// retención en la tarjeta. MP rechaza cancelar un pago ya aprobado — para ese
// caso se usa refundMpPayment.
export const cancelMpPayment = async (paymentId: string | number) => {
  return new Payment(mpClient()).cancel({ id: paymentId });
};

// Reembolso total de un pago aprobado (backstop: el comprador pagó con otro
// medio y el pago viejo se aprobó igual → se le devuelve a la misma persona).
export const refundMpPayment = async (paymentId: string | number) => {
  return new PaymentRefund(mpClient()).create({ payment_id: paymentId });
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

// Identificación del pagador para MP Perú, deducida del formato del documento.
// Tipos válidos verificados contra la cuenta: DNI (8 díg), C.E (8-12 díg),
// RUC (11-12), Otro (5-20 díg) — TODOS numéricos, NO existe "PAS"/pasaporte.
// Un DNI son 8 dígitos; un documento numérico de 9-12 se manda como C.E (Carné
// de Extranjería). Un pasaporte alfanumérico no encaja en ningún tipo → se
// devuelve null y se OMITE (la identificación es opcional; el pago procede).
export const mpPeruIdentification = (
  doc: string | null,
): { type: string; number: string } | null => {
  if (!doc) return null;
  if (/^\d{8}$/.test(doc)) return { type: "DNI", number: doc };
  if (/^\d{9,12}$/.test(doc)) return { type: "C.E", number: doc };
  return null;
};

export type MpPaymentItem = {
  id: string;
  title: string;
  description?: string;
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
  const { data: types } = await db.from("ticket_types").select("id, name, description").in("id", typeIds);
  const byId = new Map(
    ((types ?? []) as Array<{ id: string; name: string; description: string | null }>).map((t) => [t.id, t]),
  );

  // Las líneas de entrada llevan su precio de cara (lo que recibe el
  // organizador). La parte de comisión que PAGA el comprador va como línea
  // aparte (abajo), no horneada en la entrada.
  const subtotalCents = rows.reduce((sum, r) => sum + (r.price_cents ?? 0), 0);
  const items: MpPaymentItem[] = typeIds.map((id) => {
    const { qty, totalCents } = byType.get(id)!;
    const tt = byId.get(id);
    const title = tt?.name ?? "Entrada";
    return {
      id,
      title,
      // `items.description` mejora el approval rate (checklist oficial de MP).
      // Si el organizador no puso descripción, cae al nombre de la entrada.
      description: (tt?.description?.trim() || title).slice(0, 256),
      quantity: qty,
      unit_price: Money.toSoles(Math.round(totalCents / qty)),
      category_id: "tickets",
    };
  });

  // Línea de servicio = lo que efectivamente se le CARGA al comprador encima del
  // subtotal = `total_cents − subtotal`. Así `additional_info.items` suma exacto
  // a `total_cents` en ambos modos:
  //  - aparte (o banda S/1–S/15): total > subtotal → aparece la línea.
  //  - included_in_price: total == subtotal (el organizador absorbe la comisión,
  //    no se le carga al comprador) → NO hay línea, la entrada ya la contiene.
  // Se usa `total_cents − subtotal`, NO `service_fee_cents`: este último es la
  // comisión de Pasape (incluye la parte que absorbe el organizador en modo
  // incluido), que NO es lo que paga el comprador.
  const { data: order } = await db
    .from("orders")
    .select("total_cents")
    .eq("id", orderId)
    .maybeSingle<{ total_cents: number | null }>();
  const buyerChargedFeeCents = (order?.total_cents ?? subtotalCents) - subtotalCents;
  if (buyerChargedFeeCents > 0) {
    items.push({
      id: "service_fee",
      title: "Servicio Pasape",
      quantity: 1,
      unit_price: Money.toSoles(buyerChargedFeeCents),
      category_id: "service_fee",
    });
  }

  return items;
};

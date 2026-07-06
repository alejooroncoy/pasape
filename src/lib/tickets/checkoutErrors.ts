/** Códigos de error del checkout (priceOrder / buy) → copy en español. */

export type PayErrorReason = {
  title: string;
  body: string;
  note: string | null;
  primaryCta?: { label: string; action: "retry" | "retry_no_promo" };
};

const YAPE_NOTE =
  "No se descuenta nada hasta que confirmes el pago. Si ya pagaste, espera unos segundos — a veces Yape demora.";

/** Códigos que el backend puede devolver en buy/quote. */
export const KNOWN_CHECKOUT_CODES = new Set([
  "failed",
  "expired",
  "insufficient_funds",
  "self_purchase_blocked",
  "sold_out",
  "guest_contact_required",
  "buy_failed",
  "in_review",
  "unknown",
  "promoter_quota_exceeded",
  "max_per_person_exceeded",
  "event_not_published",
  "event_sales_closed",
  "ticket_type_sales_closed",
  "event_not_found",
  "buyer_required",
  "box_qty_must_be_one",
  "order_create_failed",
  "tickets_create_failed",
  "order_already_processing",
]);

export const PAY_ERROR_REASONS: Record<string, PayErrorReason> = {
  failed: {
    title: "No pudimos cobrarte",
    body: "El banco rechazó el pago. Intenta de nuevo o usa otro método.",
    note: YAPE_NOTE,
  },
  expired: {
    title: "El código expiró",
    body: "El código de Yape se venció antes de confirmarse. Pide uno nuevo.",
    note: YAPE_NOTE,
  },
  insufficient_funds: {
    title: "Saldo insuficiente",
    body: "Yape dice que no tienes saldo suficiente. Recarga e intenta de nuevo.",
    note: YAPE_NOTE,
  },
  self_purchase_blocked: {
    title: "Ese código es tuyo",
    body: "No puedes comprar con tu propio código de promotor — está pensado para que otras personas te apoyen. Si quieres una entrada, compra sin código.",
    note: null,
    primaryCta: { label: "Comprar sin tu código", action: "retry_no_promo" },
  },
  sold_out: {
    title: "Se acabaron",
    body: "Alguien se llevó la última entrada mientras pagabas. No se te cobró nada.",
    note: null,
  },
  guest_contact_required: {
    title: "Faltan datos",
    body: "Necesitamos tu WhatsApp o email para enviarte el QR.",
    note: null,
  },
  buy_failed: {
    title: "No pudimos completar tu pedido",
    body: "Algo falló de nuestro lado. No se te cobró nada — intenta de nuevo en unos segundos.",
    note: null,
  },
  in_review: {
    title: "Tu pago está en revisión",
    body: "Tu banco está validando el pago (a veces tarda un poco). Apenas lo confirme, te llega tu QR por correo y WhatsApp. No se te cobró dos veces.",
    note: "Podés cerrar esta pantalla y volver más tarde — revisá tu correo o WhatsApp.",
  },
  promoter_quota_exceeded: {
    title: "Cupo del promotor agotado",
    body: "Este link de promotor ya no tiene entradas disponibles. Compra directo al evento.",
    note: null,
    primaryCta: { label: "Comprar sin código", action: "retry_no_promo" },
  },
  max_per_person_exceeded: {
    title: "Límite por persona",
    body: "Alcanzaste el máximo de entradas que puedes comprar para este evento.",
    note: null,
  },
  event_not_published: {
    title: "Evento no disponible",
    body: "Este evento todavía no está a la venta o ya no acepta compras.",
    note: null,
  },
  event_sales_closed: {
    title: "Ventas cerradas",
    body: "Las entradas para este evento ya no están a la venta.",
    note: null,
  },
  ticket_type_sales_closed: {
    title: "Preventa cerrada",
    body: "Este tipo de entrada ya no está disponible.",
    note: null,
  },
  buyer_required: {
    title: "Faltan tus datos",
    body: "Completa tus datos de comprador e intenta de nuevo.",
    note: null,
  },
  unknown: {
    title: "No pudimos cobrarte",
    body: "Algo salió mal con el pago. Tu entrada no fue cobrada.",
    note: YAPE_NOTE,
  },
  order_already_processing: {
    title: "Pago en proceso",
    body: "Ya hay un intento de pago en curso para esta orden. Esperá unos minutos antes de reintentar.",
    note: "Si cerraste la app a mitad del pago, el bloqueo se libera solo en unos minutos.",
  },
};

/** Normaliza un error crudo del API a un código estable para URL/UI. */
export function normalizeCheckoutErrorCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "unknown";
  const lower = trimmed.toLowerCase();
  if (lower.includes("insufficient")) return "insufficient_funds";
  const base = trimmed.split(":")[0]?.trim() ?? trimmed;
  if (KNOWN_CHECKOUT_CODES.has(base)) return base;
  if (PAY_ERROR_REASONS[base]) return base;
  return "buy_failed";
}

/** Copy inline en buy (toast/alert bajo el CTA). */
export function checkoutErrorMessage(raw: string, maxPerPerson?: number | null): string {
  const code = normalizeCheckoutErrorCode(raw);
  if (code === "max_per_person_exceeded") {
    return maxPerPerson
      ? `Alcanzaste el máximo de ${maxPerPerson} ${maxPerPerson === 1 ? "entrada" : "entradas"} por persona para este evento.`
      : PAY_ERROR_REASONS.max_per_person_exceeded.body;
  }
  const info = PAY_ERROR_REASONS[code];
  if (info) return info.body;
  return PAY_ERROR_REASONS.buy_failed.body;
}

/** Solo códigos whitelisteados van en ?reason= (L8). */
export function payErrorReasonParam(raw: string, opts?: { freeOrder?: boolean }): string {
  if (opts?.freeOrder) return "buy_failed";
  const code = normalizeCheckoutErrorCode(raw);
  return KNOWN_CHECKOUT_CODES.has(code) ? code : "buy_failed";
}

export function payErrorInfo(reasonKey: string): PayErrorReason {
  return PAY_ERROR_REASONS[reasonKey] ?? PAY_ERROR_REASONS.unknown;
}

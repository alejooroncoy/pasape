/**
 * Comisión de servicio de Pasape, por TRAMOS sobre el subtotal de entradas
 * de PAGO de toda la orden (no por entrada — ver copy público en
 * /organizadores, sección Precio). Las entradas gratis no suman al
 * subtotal, así que no generan comisión. PURO (sin React, sin I/O) para
 * usarse igual en el cliente (preview del checkout) y en el servidor
 * (fuente de verdad al crear la orden — nunca se confía en el fee que
 * calcule el cliente).
 *
 * Costo real que Mercado Pago le cobra a Pasape (medido 2026-07-03 desde el
 * simulador de costos de la cuenta): 3.49% + S/1.00 + IGV(18%) sobre el
 * monto TOTAL cobrado ≈ 4.12% + S/1.18 fijo. Esa curva es la que fija los
 * tramos de abajo:
 *
 * - Tramo 1 (S/0–S/300 de subtotal): 10% flat, con piso de S/2 — cubre con
 *   margen el costo fijo de MP incluso en el mínimo absoluto (S/1 de
 *   entrada, fee S/2, margen ~S/0.70 tras descontar el costo real de MP).
 * - Tramo 2 (más de S/300): 10% sobre los primeros S/300 (=S/30 fijos) +
 *   5% SOLO sobre el excedente (como un tramo de impuesto, no sobre todo
 *   el monto) — un tope fijo (ej. S/15) eventualmente lo supera cualquier
 *   entrada lo bastante cara (el costo de MP crece proporcional al monto,
 *   sin techo); 5% marginal sí se mantiene siempre por encima del ~4.12%
 *   de costo real, así que el margen de Pasape queda positivo y creciente
 *   sin importar qué tan cara sea la entrada (verificado hasta S/10,000+).
 *
 * Es continuo en la frontera (S/300 da exactamente S/30 desde ambos lados).
 */

export const SERVICE_FEE_RATE = 0.1;
// Piso único S/3 (sin tramos): simple de explicar ("la comisión mínima
// siempre es S/3") y matemáticamente seguro — el margen queda positivo en
// todo el rango de S/1 a S/30 (donde el 10% empieza a superar el piso),
// sin huecos ni saltos.
export const SERVICE_FEE_FLOOR_CENTS = 300; // S/3
export const SERVICE_FEE_BRACKET2_CEILING_CENTS = 30_000; // S/300 de subtotal
export const SERVICE_FEE_RATE_ABOVE_BRACKET2 = 0.05;

/**
 * Precio mínimo absoluto para una entrada de PAGO: S/1. No depende de
 * `fee_mode`: ver `resolveOrderFee` — cualquier entrada entre S/1 y S/15
 * SIEMPRE oculta el desglose del fee al comprador (sin importar el modo
 * elegido), así que nunca se ve como un recargo sorpresa. No aplica a
 * entradas gratis (priceCents === 0).
 */
export const MIN_PAID_TICKET_PRICE_CENTS = 100; // S/1 — piso absoluto, todos los modos.

/** @deprecated usar MIN_PAID_TICKET_PRICE_CENTS directo — ya no varía por fee_mode. */
export function minPaidTicketPriceCents(): number {
  return MIN_PAID_TICKET_PRICE_CENTS;
}

/** Umbral bajo el cual el fee SIEMPRE se cobra pero NUNCA se muestra como línea aparte. */
export const HIDDEN_FEE_THRESHOLD_CENTS = 1500; // S/15

export type ServiceFeeLineInput = {
  /** Precio unitario YA resuelto (precio activo, tras promos). */
  unitPriceCents: number;
  /** Unidades efectivamente cobradas (tras 2x1/3x2 — ver `chargedQty` de applyPromos). */
  chargedQty: number;
};

/** Fee por tramos sobre el subtotal de entradas de pago de toda la orden. */
export function computeServiceFeeCents(lines: ServiceFeeLineInput[]): number {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.chargedQty, 0);
  if (subtotalCents === 0) return 0; // orden 100% gratis: sin fee.

  const raw =
    subtotalCents <= SERVICE_FEE_BRACKET2_CEILING_CENTS
      ? subtotalCents * SERVICE_FEE_RATE
      : SERVICE_FEE_BRACKET2_CEILING_CENTS * SERVICE_FEE_RATE +
        (subtotalCents - SERVICE_FEE_BRACKET2_CEILING_CENTS) * SERVICE_FEE_RATE_ABOVE_BRACKET2;

  return Math.max(Math.round(raw), SERVICE_FEE_FLOOR_CENTS);
}

export type ResolvedOrderFee = {
  /** Lo que efectivamente se suma a lo cobrado (order.total_cents). */
  chargedFeeCents: number;
  /** Si se debe mostrar una línea "Servicio" aparte en el checkout. */
  showFeeLine: boolean;
};

/**
 * Resuelve cuánto se cobra de fee y si se muestra como línea aparte.
 *
 * Regla (protege a Pasape Y al comprador de un desglose que asuste):
 * - Subtotal < S/15: el fee SIEMPRE se cobra (el organizador igual recibe
 *   su 100%, Pasape igual cobra su comisión) pero NUNCA se muestra aparte
 *   — sin importar `fee_mode`. Por debajo de S/15 el % es demasiado alto
 *   para mostrarlo sin que parezca un recargo absurdo, así que se
 *   esconde dentro del total en vez de obligar al organizador a
 *   absorberlo.
 * - Subtotal >= S/15: se respeta `fee_mode` tal cual lo eligió el
 *   organizador — `buyer_pays_extra` cobra aparte y lo muestra;
 *   `included_in_price` lo absorbe el organizador (fee = 0 cobrado al
 *   comprador) y tampoco se muestra (ya está adentro del precio).
 */
export function resolveOrderFee(
  subtotalCents: number,
  feeMode: "buyer_pays_extra" | "included_in_price",
  lines: ServiceFeeLineInput[],
): ResolvedOrderFee {
  if (subtotalCents === 0) return { chargedFeeCents: 0, showFeeLine: false };
  const feeCents = computeServiceFeeCents(lines);
  if (subtotalCents < HIDDEN_FEE_THRESHOLD_CENTS) {
    return { chargedFeeCents: feeCents, showFeeLine: false };
  }
  if (feeMode === "included_in_price") {
    return { chargedFeeCents: 0, showFeeLine: false };
  }
  return { chargedFeeCents: feeCents, showFeeLine: true };
}

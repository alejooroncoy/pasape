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
 * - Tramo 1 (S/0–S/300 de subtotal): 10% flat, con piso de S/3 — cubre con
 *   margen el costo fijo de MP en el rango bajo (por debajo de ~S/22 de
 *   subtotal el 10% solo no alcanza a cubrir el S/1.18 fijo de MP).
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
export const SERVICE_FEE_FLOOR_CENTS = 300;
export const SERVICE_FEE_BRACKET2_CEILING_CENTS = 30_000; // S/300 de subtotal
export const SERVICE_FEE_RATE_ABOVE_BRACKET2 = 0.05;

/**
 * Precio mínimo para una entrada de PAGO. Por debajo de esto, el piso de
 * S/3 del fee es una proporción absurda del precio (ej. S/1 de entrada +
 * S/3 de fee = 300% de recargo). No aplica a entradas gratis (priceCents === 0).
 */
export const MIN_PAID_TICKET_PRICE_CENTS = 1500; // S/15 — fee ~20% del precio en ese punto.

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

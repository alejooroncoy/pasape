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
 *   margen el costo fijo de MP incluso en el mínimo absoluto (S/1 de
 *   entrada, fee S/3, margen ~S/1.65 tras descontar el costo real de MP).
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
// Piso S/3 POR ENTRADA (no por orden): cada entrada barata lleva su propio
// mínimo, así el precio "todo incluido" por entrada es estable — 1×S/1 = S/4,
// 2×S/1 = S/8, 3×S/1 = S/12. Eso permite hornear la comisión dentro del
// precio que ve el comprador (una sola cifra por entrada, sin línea aparte).
// Simple de explicar y matemáticamente seguro (margen positivo de S/1 a S/30).
export const SERVICE_FEE_FLOOR_CENTS = 300; // S/3 por entrada
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

export type FeeMode = "buyer_pays_extra" | "included_in_price";

/** Comisión bruta por tramos de UNA entrada, según su precio unitario. */
function bracketedUnitFeeCents(unitPriceCents: number): number {
  const raw =
    unitPriceCents <= SERVICE_FEE_BRACKET2_CEILING_CENTS
      ? unitPriceCents * SERVICE_FEE_RATE
      : SERVICE_FEE_BRACKET2_CEILING_CENTS * SERVICE_FEE_RATE +
        (unitPriceCents - SERVICE_FEE_BRACKET2_CEILING_CENTS) * SERVICE_FEE_RATE_ABOVE_BRACKET2;
  return Math.round(raw);
}

export type UnitFee = {
  /**
   * Comisión de Pasape por 1 unidad — SIEMPRE que la entrada sea de pago, sin
   * importar el modo. Es lo que Pasape gana y lo que se guarda en
   * `orders.service_fee_cents` para la liquidación (ingreso del organizador =
   * total_cents − service_fee_cents, uniforme en ambos modos).
   */
  commissionCents: number;
  /**
   * Cuánto de esa comisión se AGREGA al total que paga el comprador:
   * = `commissionCents` cuando va aparte (el comprador la paga encima);
   * = 0 cuando el organizador la absorbe (`included_in_price`, ya está en su
   * precio). El total cobrado = subtotal + Σ chargedToBuyerCents.
   */
  chargedToBuyerCents: number;
  /** Si se muestra como línea "Servicio" aparte al comprador en el checkout. */
  showFeeLine: boolean;
};

/**
 * Comisión de UNA entrada (por unidad). Separa TRES cosas que antes se
 * confundían: cuánto gana Pasape (`commissionCents`, siempre), cuánto se le
 * suma al comprador (`chargedToBuyerCents`), y si se muestra aparte
 * (`showFeeLine`). El piso S/3 es por unidad.
 *
 * - Entrada < S/15: la comisión SIEMPRE la paga el comprador encima (aparte)
 *   pero NUNCA se le muestra — para él es un solo precio. No es "incluida":
 *   el organizador recibe su precio completo. Aplica sin importar `fee_mode`.
 * - Entrada >= S/15: se respeta `fee_mode` — `buyer_pays_extra` la cobra encima
 *   y la muestra; `included_in_price` la absorbe el organizador (0 extra al
 *   comprador, pero la comisión igual EXISTE y se le descuenta en liquidación).
 */
export function computeUnitFeeCents(unitPriceCents: number, feeMode: FeeMode): UnitFee {
  if (unitPriceCents <= 0) {
    return { commissionCents: 0, chargedToBuyerCents: 0, showFeeLine: false }; // gratis.
  }
  const commissionCents = Math.max(bracketedUnitFeeCents(unitPriceCents), SERVICE_FEE_FLOOR_CENTS);
  if (unitPriceCents < HIDDEN_FEE_THRESHOLD_CENTS) {
    // Banda barata: aparte (el comprador la paga) pero oculta.
    return { commissionCents, chargedToBuyerCents: commissionCents, showFeeLine: false };
  }
  if (feeMode === "included_in_price") {
    // El organizador la absorbe: existe (se le descuenta) pero 0 extra al comprador.
    return { commissionCents, chargedToBuyerCents: 0, showFeeLine: false };
  }
  // Aparte, >= S/15: el comprador la paga y se le muestra.
  return { commissionCents, chargedToBuyerCents: commissionCents, showFeeLine: true };
}

/**
 * Precio "todo incluido" que ve el comprador por 1 unidad = precio + lo que se
 * le carga de comisión. Para entradas baratas o `buyer_pays_extra` incluye la
 * comisión; para `included_in_price` es el precio tal cual (el organizador la
 * absorbe). ÚNICA fuente del número que se pinta en tarjeta, línea y total.
 */
export function buyerUnitPriceCents(unitPriceCents: number, feeMode: FeeMode): number {
  return unitPriceCents + computeUnitFeeCents(unitPriceCents, feeMode).chargedToBuyerCents;
}

/** Suma de comisiones de Pasape de todas las líneas (piso por unidad). */
export function computeServiceFeeCents(lines: ServiceFeeLineInput[], feeMode: FeeMode = "buyer_pays_extra"): number {
  return lines.reduce(
    (sum, l) => sum + computeUnitFeeCents(l.unitPriceCents, feeMode).commissionCents * l.chargedQty,
    0,
  );
}

export type ResolvedOrderFee = {
  /** Comisión total de Pasape (para `orders.service_fee_cents`, SIEMPRE). */
  commissionCents: number;
  /** Cuánto se suma al total que paga el comprador (total = subtotal + esto). */
  chargedToBuyerCents: number;
  /** Si se debe mostrar una línea "Servicio" aparte en el checkout. */
  showFeeLine: boolean;
};

/**
 * Agrega la comisión de toda la orden LÍNEA por LÍNEA (cada entrada decide su
 * comportamiento según su propio precio y el `fee_mode` — ver
 * `computeUnitFeeCents`). Devuelve por separado la comisión de Pasape (siempre)
 * y lo que se le carga al comprador (0 en `included_in_price`).
 *
 * `subtotalCents` se mantiene por firma (solo para el corte de orden 100% gratis).
 */
export function resolveOrderFee(
  subtotalCents: number,
  feeMode: FeeMode,
  lines: ServiceFeeLineInput[],
): ResolvedOrderFee {
  if (subtotalCents === 0) return { commissionCents: 0, chargedToBuyerCents: 0, showFeeLine: false };
  let commissionCents = 0;
  let chargedToBuyerCents = 0;
  let showFeeLine = false;
  for (const l of lines) {
    const u = computeUnitFeeCents(l.unitPriceCents, feeMode);
    commissionCents += u.commissionCents * l.chargedQty;
    chargedToBuyerCents += u.chargedToBuyerCents * l.chargedQty;
    if (u.showFeeLine) showFeeLine = true;
  }
  return { commissionCents, chargedToBuyerCents, showFeeLine };
}

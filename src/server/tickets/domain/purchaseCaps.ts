// Topes de compra por identidad — defensa DURA contra sobrecompra/multicuenta,
// independiente del bot score (que solo encarece el intento). El cap pone el
// piso garantizado: aunque el revendedor rote devices, cuentas y DNIs, cada
// identidad no-falsificable (DNI del holder, tarjeta) tiene un techo.
//
// Regla de producto (2026-07-10): NO es opt-in. Si el organizador no configura
// `events.max_tickets_per_person`, igual aplicamos el default — nunca dejar la
// compra sin techo.

/** Tope por persona (DNI del holder) por evento cuando el organizador no lo fija. */
export const DEFAULT_MAX_TICKETS_PER_PERSON = 6;

/**
 * El tope por tarjeta es más alto que el de persona: una familia puede pagar
 * varias entradas legítimamente con una sola tarjeta, pero un anillo con decenas
 * de DNIs por tarjeta no. Multiplica el tope por persona vigente.
 */
export const CARD_CAP_MULTIPLIER = 2;

/** Tope por persona efectivo: el configurado por el organizador, o el default. */
export function effectiveMaxPerPerson(configured: number | null | undefined): number {
  return configured != null && configured > 0 ? configured : DEFAULT_MAX_TICKETS_PER_PERSON;
}

/** Tope por tarjeta efectivo a partir del tope por persona vigente. */
export function effectiveMaxPerCard(configured: number | null | undefined): number {
  return effectiveMaxPerPerson(configured) * CARD_CAP_MULTIPLIER;
}

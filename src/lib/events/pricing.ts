import type { Promo, PromoKind, TicketType } from "@/server/events/domain/Event";

/**
 * Motor de "precio activo" + promociones. PURO (sin React, sin I/O) para poder
 * usarse igual en el cliente (display) y en el servidor (checkout). El precio
 * que se muestra al comprador y el que se cobra deben salir de aquí.
 */

export type ActivePricing = {
  /** Precio a cobrar hoy (gratis si está liberada, preventa si está vigente, si no el normal). */
  priceCents: number;
  /** Precio normal/regular (para mostrar tachado cuando hay preventa o liberación). */
  basePriceCents: number;
  /** True si la entrada está liberada gratis ahora (override sobre preventa). */
  isFree: boolean;
  /** Cuándo deja de ser gratis (ISO) o null = "mientras esté activa". Solo si isFree. */
  freeUntilAt: string | null;
  /** True si la preventa está vigente ahora. */
  isPresale: boolean;
  /** Cuántas quedan a precio de preventa. null = sin límite por stock. */
  presaleRemaining: number | null;
  /** Cierre de la preventa por fecha (ISO) o null. */
  presaleEndsAt: string | null;
};

/** Campos mínimos para resolver el precio activo (sirve a TicketType y a rows snake-mapeados). */
export type PricingInput = Pick<
  TicketType,
  | "priceCents"
  | "presalePriceCents"
  | "presaleQty"
  | "presaleEndsAt"
  | "sold"
  | "isPresaleActive"
  | "isFreeActive"
  | "freeUntilAt"
>;

/**
 * Regla única: el backend precalcula `isFreeActive` y `isPresaleActive`. El
 * frontend no compara fechas ni stock. La liberación gratis GANA sobre la
 * preventa (precio 0 manda).
 */
export function activePricing(tt: PricingInput): ActivePricing {
  const base = tt.priceCents;
  if (tt.isFreeActive) {
    return {
      priceCents: 0,
      basePriceCents: base,
      isFree: true,
      freeUntilAt: tt.freeUntilAt,
      isPresale: false,
      presaleRemaining: null,
      presaleEndsAt: null,
    };
  }
  if (!tt.isPresaleActive || tt.presalePriceCents == null) {
    return {
      priceCents: base,
      basePriceCents: base,
      isFree: false,
      freeUntilAt: null,
      isPresale: false,
      presaleRemaining: null,
      presaleEndsAt: null,
    };
  }
  return {
    priceCents: tt.presalePriceCents,
    basePriceCents: base,
    isFree: false,
    freeUntilAt: null,
    isPresale: true,
    presaleRemaining: tt.presaleQty == null ? null : Math.max(0, tt.presaleQty - tt.sold),
    presaleEndsAt: tt.presaleEndsAt,
  };
}

export type PromoLineInput = {
  ticketTypeId: string;
  qty: number;
  /** Precio unitario YA resuelto (precio activo de la entrada). */
  unitPriceCents: number;
};

export type PromoLine = PromoLineInput & {
  /** Unidades efectivamente cobradas tras la promo (ej. 2x1 sobre 4 → 2). */
  chargedQty: number;
  subtotalCents: number;
  promo: PromoKind | null;
};

export type PromoResult = { totalCents: number; lines: PromoLine[] };

/** Unidades a cobrar según la promo (2x1: paga la mitad redondeada arriba; 3x2). */
export function chargedUnits(qty: number, promo: PromoKind | null): number {
  if (promo === "2x1") return qty - Math.floor(qty / 2);
  if (promo === "3x2") return qty - Math.floor(qty / 3);
  return qty;
}

/**
 * Aplica las promos activas a los items del carrito. Asume como máximo una promo
 * por entrada (si hubiera varias, gana la última de la lista).
 * Usa `p.isActive` precomputado por el backend — el frontend no compara fechas.
 */
export function applyPromos(
  items: PromoLineInput[],
  promos: Promo[],
): PromoResult {
  const activeByTt = new Map<string, PromoKind>();
  for (const p of promos) {
    if (!p.isActive) continue;
    activeByTt.set(p.ticketTypeId, p.kind);
  }
  let total = 0;
  const lines: PromoLine[] = items.map((it) => {
    const promo = activeByTt.get(it.ticketTypeId) ?? null;
    const charged = chargedUnits(it.qty, promo);
    const subtotal = charged * it.unitPriceCents;
    total += subtotal;
    return { ...it, chargedQty: charged, subtotalCents: subtotal, promo };
  });
  return { totalCents: total, lines };
}

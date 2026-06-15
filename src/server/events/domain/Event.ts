export type EventStatus = "draft" | "published" | "closed" | "cancelled";

export type PresaleTier = {
  id: string;
  ticketTypeId: string;
  priceCents: number;
  endsAt: string;
  position: number;
};

export type EventCategory =
  | "conciertos"
  | "fiestas"
  | "festivales"
  | "comedia"
  | "cultura"
  | "deportes";

export type TransferPolicy = {
  enabled: boolean;
  deadlineHours: number | null;
  maxCount: number;
  requiresKyc: boolean;
};

export type CapacityPolicy = {
  totalCapacity: number | null;
  overbookPct: number;
};

export type Event = {
  id: string;
  slug: string;
  organizationId: string;
  createdBy: string;
  title: string;
  description: string | null;
  venue: string | null;
  venueLat: number | null;
  venueLng: number | null;
  venueUrl: string | null;
  venueSource: "manual" | "google" | "apple" | null;
  coverUrl: string | null;
  venueLayoutUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: EventStatus;
  category: EventCategory | null;
  /** Moneda del evento (ISO 4217). Default 'PEN'; preparado para multi-mercado. */
  currency: string;
  capacity: CapacityPolicy;
  transferPolicy: TransferPolicy;
  version: number;
  createdAt: string;
  /**
   * Stats de listado (opcional): solo lo adjunta `listByOrganization` desde el
   * rollup para que las cards muestren ventas reales sin una query por card.
   * El frontend solo lo muestra; el backend lo calcula.
   */
  listStats?: { sold: number; capacity: number; revenueCents: number };
};

// "presale" se retiró: la preventa ya no es un tipo de entrada, es un atributo
// (presalePriceCents/presaleQty/presaleEndsAt). Una entrada = un acceso.
// "invitation" (cortesía) es el tipo que el promotor reparte por su lista de
// invitados: precio 0, oculto al público, emitido solo desde la app del promotor.
export type TicketTypeKind = "general" | "vip" | "box" | "invitation";

/** Promoción aplicada a una entrada. Solo 2x1 / 3x2 por ahora. */
export type PromoKind = "2x1" | "3x2";

export type Promo = {
  id: string;
  eventId: string;
  ticketTypeId: string;
  kind: PromoKind;
  /** ISO 8601. Si está definido, la promo deja de aplicar al pasar esta fecha. */
  endsAt: string | null;
  /** Backend-computed: si la promo está vigente ahora. */
  isActive: boolean;
};

export type TicketType = {
  id: string;
  eventId: string;
  name: string;
  kind: TicketTypeKind;
  priceCents: number;
  currency: string;
  capacity: number;
  sold: number;
  position: number;
  /**
   * Etiqueta humana del box (A, B, VIP-1) cuando `kind === "box"`. Permite que
   * el portero distinga BOX A vs BOX B al escanear cualquier QR del box.
   * Para ticket types no-box queda null.
   */
  boxLabel: string | null;
  /**
   * Zona del venue ("Boxes Premium 1er Piso", "Mesas Premium", "Zona Chivas")
   * usada para agrupar la lista al comprador. Coincide con el plano referencial
   * que el organizador publica. Opcional: si es null, el ticket type aparece sin
   * agrupar.
   */
  zone: string | null;
  /**
   * Sustantivo que el organizador usa para esta unidad reservable: "box",
   * "mesa", "lounge", "espacio" u otro custom. Si es null, el display usa
   * "box" por default. Solo aplica cuando kind === "box".
   */
  unitNoun: string | null;
  /**
   * ISO 8601. Si está definido, las ventas de este tipo de entrada se cierran
   * automáticamente cuando se alcanza esta fecha/hora, independientemente del
   * estado del evento. Útil para preventas con fecha límite.
   */
  saleEndsAt: string | null;
  /**
   * PREVENTA — precio más bajo al arrancar. Si `presalePriceCents` es null, la
   * entrada no tiene preventa. Vigente mientras no se agote `presaleQty` (se
   * compara contra `sold`) y no se pase `presaleEndsAt`. Al terminar, la entrada
   * sigue vendiéndose a `priceCents`. Ver `src/lib/events/pricing.ts`.
   */
  presalePriceCents: number | null;
  /** "Las primeras N" entradas a precio de preventa. null = sin límite por stock. */
  presaleQty: number | null;
  /** ISO 8601. Cierre de la preventa por fecha (≠ saleEndsAt, que cierra la venta). */
  presaleEndsAt: string | null;
  /** Descripción corta visible al comprador: beneficios, restricciones, qué incluye. */
  description: string | null;
  /** Backend-computed: estado de venta. El frontend NO lo recalcula desde fechas. */
  saleStatus: "available" | "expired" | "soldout";
  /** Backend-computed: si la preventa está vigente ahora. */
  isPresaleActive: boolean;
  /** Tramos de preventa ordenados por ends_at asc. El backend elige el activo. */
  presaleTiers: PresaleTier[];
};

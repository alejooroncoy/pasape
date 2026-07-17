import type { CustomField } from "@/lib/events/customFields";

export type EventStatus = "draft" | "pending_review" | "published" | "closed" | "cancelled";

// Ventana de gracia para vitrinas (org showcase, hub de marca): un evento que
// ya empezó pero hace poco todavía se muestra como "próximo" en vez de
// desaparecer de golpe al cruzar startsAt.
export const SHOWCASE_RECENT_GRACE_MS = 6 * 3600 * 1000;

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
  | "deportes"
  | "charlas";

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

/** buyer_pays_extra: comisión aparte del precio (default). included_in_price:
 *  el precio ya la incluye, la absorbe el organizador. */
export type FeeMode = "buyer_pays_extra" | "included_in_price";

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
  /** Paleta elegida por el organizador para tematizar la página pública del
   *  evento (extraída del flyer o personalizada) — null en los 3 campos usa
   *  el morado de marca por defecto (ver `derivePalette` en
   *  `@/lib/_shared/color`). Los 3 viajan juntos porque combinan entre sí:
   *  no se derivan matemáticamente unos de otros. */
  paletteDark: string | null;
  paletteMid: string | null;
  paletteAccent: string | null;
  venueLayoutUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: EventStatus;
  /** Motivo que Pasape escribió al rechazar (status vuelve a "draft"). Se
   *  limpia solo cuando el organizador reenvía a revisión (ver UpdateEvent.ts). */
  rejectedReason: string | null;
  category: EventCategory | null;
  /** Moneda del evento (ISO 4217). Default 'PEN'; preparado para multi-mercado. */
  currency: string;
  capacity: CapacityPolicy;
  /**
   * Tope de entradas individuales que UNA persona puede comprar en total para
   * este evento (acumulado entre compras, identificado por DNI). null = sin
   * límite. Los boxes se venden enteros y no cuentan contra este tope. El
   * backend lo hace cumplir en la compra; el frontend solo lo muestra/limita.
   */
  maxTicketsPerPerson: number | null;
  transferPolicy: TransferPolicy;
  /** Quién absorbe la comisión de Pasape: el comprador (aparte, default) o
   *  el organizador (ya incluida en el precio que puso). */
  feeMode: FeeMode;
  version: number;
  createdAt: string;
  /**
   * Preguntas extra de registro definidas por el organizador (estilo Luma:
   * Custom Questions). El frontend solo renderiza el formulario a partir de
   * este array — ver `@/lib/events/customFields` (módulo único, no
   * reimplementar el shape en otro lado).
   */
  customFields: CustomField[];
  /**
   * Stats de listado (opcional): solo lo adjunta `listByOrganization` desde el
   * rollup para que las cards muestren ventas reales sin una query por card.
   * El frontend solo lo muestra; el backend lo calcula.
   */
  /** `capacity: null` = sin límite (algún tipo de entrada del evento no tiene tope). */
  listStats?: { sold: number; capacity: number | null; revenueCents: number };
};

/**
 * Shape mínimo para listados públicos (home, categorías, búsqueda): lo único
 * que pintan FeaturedBanner/EventCard. No trae description, palette*,
 * venueLat/Lng, capacity/transferPolicy/feeMode ni otros campos que solo usa
 * la página de detalle (`getBySlug`) — evita `select("*")` en el hot path del
 * home. Si una card nueva necesita un campo más, agrégalo aquí explícitamente.
 */
export type EventCard = Pick<
  Event,
  "id" | "slug" | "title" | "coverUrl" | "venue" | "startsAt" | "timezone" | "category"
>;

/**
 * Shape para generadores SEO server-only (sitemap.ts, llms.txt) — no es
 * hot-path de usuario, corre en build/crawl, así que puede llevar algunos
 * campos más que `EventCard` (description, status, createdAt) sin volver a
 * `select("*")` completo (sigue sin palette, venueLat/Lng, capacity, etc.).
 */
export type EventSeoEntry = Pick<
  Event,
  | "slug"
  | "title"
  | "description"
  | "venue"
  | "startsAt"
  | "timezone"
  | "status"
  | "category"
  | "createdAt"
>;

// El kind solo codifica COMPORTAMIENTO, no la etiqueta comercial:
// - "general": entrada individual (1 persona, 1 QR). El NOMBRE carga la
//   distinción comercial ("VIP", "General", "After") — por eso "vip" se retiró.
// - "box": espacio reservable (asientos, invita, stock binario).
// "presale" también se retiró: la preventa es un atributo, no un tipo. Lo
// "gratis" tampoco es un kind: es una entrada a precio 0 (el flujo normal de
// compra la cobra a 0, sin caso especial).
export type TicketTypeKind = "general" | "box";

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

/**
 * Campos comunes a todo tipo de entrada. NO incluye el cupo: ese es ambiguo
 * (asientos en un box vs stock en una entrada) y se modela por variante abajo,
 * para que el compilador impida confundirlos. Ver AGENTS.md ("capacity es
 * ambiguo") y los helpers en `@/lib/events/ticketDisplay`.
 */
type TicketTypeBase = {
  id: string;
  eventId: string;
  name: string;
  priceCents: number;
  /**
   * Backend-computed: precio "todo incluido" que ve y paga el comprador por 1
   * unidad, sobre el precio ACTIVO (gratis/preventa/normal). Cuando la comisión
   * va horneada (entradas baratas), ya la incluye (ej. priceCents S/1 →
   * buyerPriceCents S/4); cuando se muestra aparte o el organizador la absorbe,
   * es igual al precio activo. El frontend pinta ESTE número — no recalcula la
   * comisión (ver `@/lib/tickets/serviceFee`, regla en AGENTS.md).
   */
  buyerPriceCents: number;
  currency: string;
  /**
   * Unidades tomadas. En una entrada = tickets vendidos. En un box = tickets del
   * box emitidos (host + acompañantes). Común a ambos, por eso vive en la base.
   */
  sold: number;
  position: number;
  /**
   * Etiqueta humana del box (A, B, VIP-1) cuando `kind === "box"`. Permite que
   * el portero distinga BOX A vs BOX B al escanear cualquier QR del box.
   * Para ticket types no-box queda null.
   */
  boxLabel: string | null;
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
  /**
   * LIBERAR GRATIS — el organizador suelta una entrada de pago a precio 0. Una
   * entrada gratis no es un kind: el flujo normal la cobra a 0. Estos campos
   * solo deciden CUÁNDO el precio efectivo es 0 (override sobre preventa).
   * `isFree` = toggle crudo del organizador.
   */
  isFree: boolean;
  /** ISO 8601. Fin de la liberación por fecha. null + `isFree` = "mientras esté activa". */
  freeUntilAt: string | null;
  /** Backend-computed: si la liberación está vigente ahora (gana sobre preventa). */
  isFreeActive: boolean;
  /** Backend-computed: estado de venta. El frontend NO lo recalcula desde fechas. */
  saleStatus: "available" | "expired" | "soldout";
  /** Backend-computed: si la preventa está vigente ahora. */
  isPresaleActive: boolean;
  /**
   * Backend: mostrar countdown FOMO (< 6h para cierre). El frontend solo renderiza;
   * no usa Date.now() para decidir visibilidad.
   */
  showCountdown: boolean;
  /** ISO fin del countdown (preventa o liberación gratis). null si no aplica. */
  countdownEndsAt: string | null;
  /** Tramos de preventa ordenados por ends_at asc. El backend elige el activo. */
  presaleTiers: PresaleTier[];
  /**
   * RSVP con aprobación (estilo Luma): el organizador aprueba/rechaza cada
   * inscripción antes de emitir el QR. Solo válido si priceCents === 0 —
   * combinar aprobación con pago es un caso no resuelto (deliberadamente
   * fuera de alcance, ver migración 20260716110000_rsvp_approval.sql).
   */
  requiresApproval: boolean;
};

/** Espacio reservable. `seats` = personas que entran (NO es stock: el box se vende entero). */
export type BoxTicketType = TicketTypeBase & {
  kind: "box";
  seats: number;
};

/**
 * Entrada individual (1 acceso = 1 persona). `stock` = cuántas se venden.
 * `null` = sin límite (eventos virtuales o sin aforo físico) — un box SIEMPRE
 * tiene asientos finitos, por eso esto no aplica a `BoxTicketType.seats`.
 */
export type AdmissionTicketType = TicketTypeBase & {
  kind: Exclude<TicketTypeKind, "box">;
  stock: number | null;
};

/**
 * Unión discriminada por `kind`. El cupo NO es un `number` plano: es `seats` en
 * un box y `stock` en una entrada. El compilador obliga a estrechar por `kind`
 * antes de leer cualquiera — imposible confundir asientos con stock.
 */
export type TicketType = BoxTicketType | AdmissionTicketType;

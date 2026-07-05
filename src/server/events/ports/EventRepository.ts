import type { Event, EventCategory, EventStatus, FeeMode, Promo, PromoKind, PresaleTier, TicketType } from "../domain/Event";
import type { Result } from "@/server/_shared/result";
import type { CommissionConfig } from "@/server/promoters/domain/OrgPromoter";
import type { MilestoneProgress } from "@/server/promoters/application/CommissionResolver";

export type CreateEventInput = {
  organizationId: string;
  createdBy: string;
  title: string;
  description: string | null;
  venue: string | null;
  venueLat: number | null;
  venueLng: number | null;
  venueUrl: string | null;
  venueSource: "manual" | "google" | "apple" | null;
  venueLayoutUrl: string | null;
  coverUrl?: string | null;
  /** Paleta elegida por el organizador (extraída del flyer o personalizada);
   *  null en los 3 = usa el morado de marca por defecto. */
  paletteDark?: string | null;
  paletteMid?: string | null;
  paletteAccent?: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  category?: EventCategory | null;
  totalCapacity: number | null;
  overbookPct: number;
  transfersEnabled: boolean;
  transferDeadlineHours: number | null;
  transferMaxCount: number;
  transferRequiresKyc: boolean;
  /** Default "buyer_pays_extra" si se omite. */
  feeMode?: FeeMode;
};

export type SalesSeriesPoint = {
  /** ISO date "YYYY-MM-DD" (día UTC). */
  day: string;
  /** Tickets activos+usados emitidos ese día. */
  ticketsSold: number;
  /** Revenue confirmado en centavos (sólo orders paid). */
  revenueCents: number;
};

export type EventStats = {
  /** Vendidas: tickets de órdenes pagadas (NO incluye reservas pendientes). */
  sold: number;
  /** Reservadas: tickets de órdenes pending dentro de la ventana de 30 min. */
  reserved: number;
  validated: number;
  /** Bruto que pagaron los compradores (sum total_cents de órdenes pagadas — incluye la comisión de Pasape). */
  revenueCents: number;
  /** Comisión de Pasape acumulada (sum service_fee_cents de órdenes pagadas). */
  serviceFeeCents: number;
  /** Lo que recibe el organizador = revenueCents − serviceFeeCents. La única definición de "neto". */
  netCents: number;
  capacity: number | null;
  /** Serie diaria desde el view `event_sales_by_day`. Vacío = sin ventas. */
  salesSeries: SalesSeriesPoint[];
  ticketTypes: Array<{
    id: string;
    name: string;
    kind: TicketType["kind"];
    priceCents: number;
    capacity: number;
    /** Vendidas (pagadas) de este tipo — NO incluye reservas. */
    sold: number;
    /** Validadas (status 'used') de este tipo. En un box: personas que ya entraron. */
    validated: number;
    /** Recaudado real de este tipo (suma de price_cents con promos), en céntimos. */
    revenueCents: number;
    /** Etiqueta humana del box (A, B, VIP-1). Solo aplica cuando kind === "box". */
    boxLabel: string | null;
    /** Sustantivo custom del organizador ("mesa", "lounge"). Solo aplica a boxes. */
    unitNoun: string | null;
  }>;
  byPromoter: Array<{
    promoterId: string;
    promoterLinkId: string;
    code: string;
    name: string;
    /** Tickets PAGADOS (orden total > 0). No incluye los gratis. */
    ticketsSold: number;
    ticketsValidated: number;
    /** Entradas GRATIS (orden total 0) atribuidas a su link. */
    guestsInvited: number;
    /** Entradas gratis que efectivamente entraron (status 'used'). */
    guestsEntered: number;
    revenueCents: number;
    /** Ratio validated/sold en [0,1]; 0 si no hay ventas. */
    attendanceRate: number;
    /**
     * Señal de autoventa para el organizador:
     *   - `ok`: sample chico, evento futuro, o asistencia ≥ 70%.
     *   - `watch`: 30% ≤ asistencia < 70%.
     *   - `suspect`: asistencia < 30% (posible autoventa de promotor).
     */
    flag: "ok" | "watch" | "suspect";
    /** % efectivo por venta (0 = sin comisión por venta). */
    commissionPct: number;
    /** True si el promotor tiene metas configuradas (efectivo/especie por umbral). */
    hasMilestones: boolean;
    /**
     * Dinero a pagar: % del vendido + hitos cash conseguidos. Los premios en
     * especie salen aparte en `unlockedRewards`.
     */
    payoutCents: number;
    /** Premios en especie desbloqueados. */
    unlockedRewards: Array<{ label: string }>;
    /** Base de conteo de los hitos ('sold'/'attended'); null si no hay hitos. */
    milestoneBasis: "sold" | "attended" | null;
    /** Conteo actual contra el que se miden los hitos (según basis). */
    milestoneCount: number;
    /** Hitos cash desbloqueados (céntimos) — la parte de `payoutCents` por metas. */
    milestoneCashCents: number;
    /** Todos los hitos con su estado de desbloqueo, para el reporte del organizador. */
    milestones: MilestoneProgress[];
  }>;
};

export type ScanFeedItem = {
  id: string;
  result: "valid" | "already_used" | "invalid" | "void" | "unknown_event";
  scannedAt: string;
  ticketId: string | null;
  scannedBy: string;
  /** Tipo de la entrada escaneada — null si el ticket no se pudo resolver. */
  ticketTypeKind: TicketType["kind"] | null;
  ticketTypeName: string | null;
  /** Etiqueta del box (A, B, VIP-1) cuando ticketTypeKind === "box". */
  boxLabel: string | null;
  /** Sustantivo del organizador ("box", "mesa"). Solo aplica cuando ticketTypeKind === "box". */
  unitNoun: string | null;
};

// Salud de las puertas (porteros) para el banner de honestidad del dashboard.
export type DoorHealth = {
  deviceId: string;
  zoneName: string | null;
  lastSyncAt: string | null;
  expiresAt: string;
  /** Minutos desde el último sync, calculado server-side. null si nunca sincronizó. */
  minutesSinceSync: number | null;
  /** True si la puerta lleva demasiado sin sincronizar (umbral del backend). */
  isStale: boolean;
  /** Nombre que el portero ingresó al canjear el código de acceso. */
  holderName: string | null;
  /** Últimos 2 dígitos del DNI del portero (display-only, el completo es server-side). */
  dniLast2: string | null;
};

export type CreateTicketTypeInput = {
  name: string;
  kind: TicketType["kind"];
  priceCents: number;
  capacity: number;
  boxLabel?: string | null;
  unitNoun?: string | null;
  saleEndsAt?: string | null;
  presalePriceCents?: number | null;
  presaleQty?: number | null;
  presaleEndsAt?: string | null;
  description?: string | null;
  /** Liberar gratis: toggle + fin opcional (null = mientras esté activa). */
  isFree?: boolean;
  freeUntilAt?: string | null;
  /** Tramos de preventa. Si se pasa, reemplaza todos los existentes. */
  presaleTiers?: Array<Pick<PresaleTier, "priceCents" | "endsAt">>;
};

export type UpdateTicketTypeInput = {
  name?: string;
  priceCents?: number;
  capacity?: number;
  boxLabel?: string | null;
  unitNoun?: string | null;
  saleEndsAt?: string | null;
  presalePriceCents?: number | null;
  presaleQty?: number | null;
  presaleEndsAt?: string | null;
  description?: string | null;
  /** Liberar gratis: toggle + fin opcional (null = mientras esté activa). */
  isFree?: boolean;
  freeUntilAt?: string | null;
  /** Tramos de preventa. Si se pasa, reemplaza todos los existentes. */
  presaleTiers?: Array<Pick<PresaleTier, "priceCents" | "endsAt">>;
};

/**
 * Esquema de promotores a nivel evento ("así pago y reparto a todos"). Default
 * que heredan los promotores del evento; cada uno puede personalizarlo. null en
 * cualquier campo = usa el default de la marca / sin tope.
 */
export type EventPromoterScheme = {
  /** % por venta default (null = usa el de la marca). */
  commissionPct: number | null;
  /** Metas default (null = usa las de la marca). Independiente del %. */
  commissionConfig: CommissionConfig | null;
  /** Cupo de ventas default por promotor. null = sin tope. */
  defaultQuota: number | null;
};

/** Una promo por entrada (la última gana). null en kind = sin promo. */
export type PromoInput = {
  ticketTypeId: string;
  kind: PromoKind;
  endsAt?: string | null;
};

export type UpdateEventInput = {
  status?: EventStatus;
  title?: string;
  description?: string | null;
  venue?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  venueUrl?: string | null;
  venueSource?: "manual" | "google" | "apple" | null;
  venueLayoutUrl?: string | null;
  coverUrl?: string | null;
  paletteDark?: string | null;
  paletteMid?: string | null;
  paletteAccent?: string | null;
  startsAt?: string;
  category?: EventCategory | null;
  totalCapacity?: number | null;
  overbookPct?: number;
  transfersEnabled?: boolean;
  transferDeadlineHours?: number | null;
  transferMaxCount?: number;
  transferRequiresKyc?: boolean;
  feeMode?: FeeMode;
};

export type AttendeeRow = {
  ticketId: string;
  holderName: string | null;
  /** DNI completo del holder, descifrado server-side (solo para lista/Excel del
      organizador; nunca viaja al celular del portero). Null si no se capturó. */
  holderDni: string | null;
  ticketTypeName: string;
  /** Etiqueta del box/espacio (A, B, VIP-1) tal como la nombró el organizador.
      null si no es un box. Sirve para agrupar a los miembros de un mismo box en
      la hoja y para el label del "Tipo". */
  boxLabel: string | null;
  /** Sustantivo del box ("box", "mesa", "lounge"), separado de la etiqueta. El
      "Tipo" de un box se arma "Noun + etiqueta" ("Box A") — misma regla que
      boxDisplayLabel en la UI. null si no es box. */
  unitNoun: string | null;
  /** Ticket del anfitrión del box al que pertenece este ticket (los acompañantes
      lo llevan; el anfitrión lo tiene en null). Agrupa el box en la hoja. */
  boxHostTicketId: string | null;
  status: "active" | "used" | "void" | "refunded";
  usedAt: string | null;
  orderId: string;
  /** Contacto de QUIEN PORTA la entrada (el que va a entrar), no del pagador:
      en una transferencia es el WhatsApp del receptor; en una compra/box normal
      es el del comprador/anfitrión. Fuente de verdad para llegar al asistente. */
  contactPhone: string | null;
  /** Email de la compra (comprador/invitado). Secundario; el canal real es el
      WhatsApp. Sintético → se enmascara al renderizar. */
  contactEmail: string | null;
  promoterCode: string | null;
  /** La orden es una cortesía del organizador (orders.is_courtesy). Cambia el
      label de estado: una cortesía active se muestra "Enviada" (aún no ingresó),
      igual que el panel de cortesías, no "Activa". */
  isCourtesy: boolean;
  /** Nombre de quien transfirió esta entrada (from_profile de la transferencia
      completada más reciente). null si nunca se transfirió. Alimenta el Origen
      "Transferida de X". */
  transferFromName: string | null;
};

export type PromoterReportRow = {
  name: string;
  code: string;
  ticketsSold: number;
  ticketsValidated: number;
  revenueCents: number;
  commissionPct: number;
  /** Comisión por venta: round(gross * pct/100), la parte del % (sin hitos). */
  saleCommissionCents: number;
  /** Hitos cash desbloqueados (céntimos). */
  milestoneCashCents: number;
  /** Dinero total: comisión por venta + hitos cash conseguidos. */
  commissionCalculatedCents: number;
  /** True si el promotor tiene metas configuradas (efectivo/especie por umbral). */
  hasMilestones: boolean;
  /** Base de conteo de los hitos ('sold'/'attended'); null si no hay hitos. */
  milestoneBasis: "sold" | "attended" | null;
  /** Conteo actual contra el que se miden los hitos (según basis). */
  milestoneCount: number;
  /** Todos los hitos con su estado de desbloqueo. */
  milestones: MilestoneProgress[];
  /** Premios en especie desbloqueados. */
  unlockedRewards: string[];
};

export type EventExportData = {
  event: Event;
  attendees: AttendeeRow[];
  promoters: PromoterReportRow[];
  summary: EventStats;
};

export interface EventRepository {
  listPublished(limit: number, cursor: string | null, category?: EventCategory | null): Promise<Event[]>;
  listByOrganization(orgId: string): Promise<Event[]>;
  listByOrgSlug(orgSlug: string): Promise<Event[]>;
  /** Solo eventos publicados de una org, ordenados por startsAt asc. */
  listPublishedByOrgSlug(orgSlug: string): Promise<Event[]>;
  getBySlug(
    slug: string,
  ): Promise<{ event: Event; ticketTypes: TicketType[]; promos: Promo[] } | null>;
  create(input: CreateEventInput): Promise<Result<Event>>;
  publish(eventId: string, orgId: string): Promise<Result<Event>>;
  update(eventId: string, orgId: string, input: UpdateEventInput): Promise<Result<Event>>;
  createTicketType(eventId: string, input: CreateTicketTypeInput): Promise<Result<TicketType>>;
  updateTicketType(
    ticketTypeId: string,
    eventId: string,
    input: UpdateTicketTypeInput,
  ): Promise<Result<TicketType>>;
  deleteTicketType(ticketTypeId: string, eventId: string): Promise<Result<{ id: string }>>;
  getTicketType(ticketTypeId: string, eventId: string): Promise<TicketType | null>;
  /** Esquema de promotores del evento (default para todos). */
  getPromoterScheme(eventId: string): Promise<EventPromoterScheme>;
  /** Actualiza el esquema de promotores del evento (solo los campos dados). */
  updatePromoterScheme(
    eventId: string,
    patch: Partial<EventPromoterScheme>,
  ): Promise<Result<true>>;
  listPromos(eventId: string): Promise<Promo[]>;
  /** Reemplaza todas las promos del evento por las dadas. */
  setPromos(eventId: string, promos: PromoInput[]): Promise<Result<Promo[]>>;
  getStats(eventId: string): Promise<EventStats>;
  listScans(eventId: string, limit: number): Promise<ScanFeedItem[]>;
  /** Puertas activas + conteo de duplicados offline para el dashboard. */
  getDoorHealth(
    eventId: string,
  ): Promise<{ doors: DoorHealth[]; dupOffline: number }>;
  exportData(eventId: string): Promise<{
    attendees: AttendeeRow[];
    promoters: PromoterReportRow[];
    summary: EventStats;
  }>;
}

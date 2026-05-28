export type EventStatus = "draft" | "published" | "closed" | "cancelled";

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
  capacity: CapacityPolicy;
  transferPolicy: TransferPolicy;
  version: number;
  createdAt: string;
};

export type TicketTypeKind = "general" | "presale" | "vip" | "box";

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
};

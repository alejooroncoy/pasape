import type { EventCategory, EventStatus } from "@/server/events/domain/Event";

export type TicketStatus = "active" | "used" | "void" | "refunded";
export type OrderStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

export type Order = {
  id: string;
  buyerId: string | null;
  eventId: string;
  promoterLinkId: string | null;
  status: OrderStatus;
  totalCents: number;
  /** Comisión de Pasape ya incluida en totalCents (10% por entrada, tope S/15/entrada). */
  serviceFeeCents: number;
  currency: string;
  createdAt: string;
};

export type Ticket = {
  id: string;
  orderId: string;
  ticketTypeId: string;
  holderName: string | null;
  holderDniLast2: string | null;
  qrCode: string;
  status: TicketStatus;
  usedAt: string | null;
  currentHolder: string;
  transferCount: number;
  createdAt: string;
  /** Label heredado del ticket_type del box ("A", "VIP-1"). Null si no es box. */
  boxLabel: string | null;
  /** Si este ticket fue emitido como amigo invitado, apunta al ticket del host. */
  boxHostTicketId: string | null;
};

export type WalletTicket = Ticket & {
  event: { id: string; slug: string; title: string; startsAt: string; venue: string | null; timezone: string; status: EventStatus; coverUrl: string | null; category: EventCategory | null };
  ticketType: { id: string; name: string; kind: string };
  /** Contacto (WhatsApp) al que se envió la entrada y aún no la reclama. Null
      si no hay transferencia pendiente. Mientras tanto el ticket sigue siendo
      del emisor (lo conserva hasta que el receptor reclame). */
  pendingTransferTo: string | null;
};

/** Resultado de un intento de transferencia. Si el destinatario ya tiene
    cuenta, la entrada pasa de inmediato (`transferred`). Si no, queda en espera
    de que reclame el link que le llega por WhatsApp (`pending`). */
export type TransferOutcome =
  | { kind: "transferred"; ticket: Ticket }
  | { kind: "pending"; toContact: string };

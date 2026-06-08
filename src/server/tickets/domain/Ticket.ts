import type { EventStatus } from "@/server/events/domain/Event";

export type TicketStatus = "active" | "used" | "void" | "refunded";
export type OrderStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

export type Order = {
  id: string;
  buyerId: string | null;
  eventId: string;
  promoterLinkId: string | null;
  status: OrderStatus;
  totalCents: number;
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
  event: { id: string; slug: string; title: string; startsAt: string; venue: string | null; timezone: string; status: EventStatus };
  ticketType: { id: string; name: string; kind: string };
};

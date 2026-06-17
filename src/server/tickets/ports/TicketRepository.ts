import type { Order, Ticket, WalletTicket } from "../domain/Ticket";
import type { Result } from "@/server/_shared/result";

export type GuestBuyer = {
  email?: string | null;
  phone?: string | null;
  fullName: string;
  dni: string;
};

export type BuyInput = {
  buyerId?: string;
  guest?: GuestBuyer | null;
  /** Datos del comprador logueado (mismos campos que guest). Se persisten en
      profiles/kyc_documents para autorrellenar la próxima compra. */
  buyer?: GuestBuyer | null;
  eventId: string;
  items: Array<{ ticketTypeId: string; qty: number; holderName?: string | null }>;
  promoCode?: string | null;
  payerEmail?: string | null;
};

export type BuyOutput = {
  order: Order;
  tickets: Ticket[];
  preference: { id: string; initPoint: string };
};

export interface TicketRepository {
  buy(input: BuyInput): Promise<Result<BuyOutput>>;
  listMine(buyerId: string): Promise<WalletTicket[]>;
  getById(ticketId: string, buyerId: string): Promise<WalletTicket | null>;
  transfer(input: {
    ticketId: string;
    fromProfile: string;
    toProfile: string | null;
    toContact: string | null;
  }): Promise<Result<Ticket>>;
  /** Deja la entrada en espera de reclamo (destinatario sin cuenta). No cambia
      el dueño: el emisor la conserva hasta que el receptor abra su link. */
  createPendingTransfer(input: {
    ticketId: string;
    fromProfile: string;
    toContact: string;
    token: string;
    expiresAt: string;
  }): Promise<Result<{ event: { title: string; startsAt: string } }>>;
  /** Reclama una transferencia pendiente: el ticket pasa a `toProfile`. */
  claimTransfer(input: {
    token: string;
    toProfile: string;
  }): Promise<Result<{ ticket: Ticket; eventSlug: string }>>;
  /** Cancela el envío pendiente del ticket (el emisor lo recupera al instante).
      El link enviado deja de servir. */
  cancelPendingTransfer(input: {
    ticketId: string;
    fromProfile: string;
  }): Promise<Result<{ ok: true }>>;
  markUsedByQr(qrCode: string, scannerId: string, usedAt?: Date): Promise<Result<MarkUsedResult>>;
  /** Admisión confiable por ticketId (alta manual o sync de scan ya verificado). */
  markUsedByTicketId(ticketId: string, scannerId: string, usedAt?: Date): Promise<Result<MarkUsedResult>>;
}

export type MarkUsedResult = {
  ticket: Ticket;
  eventId: string;
  holderName: string | null;
  holderDniLast2: string | null;
  ticketTypeName: string | null;
  boxLabel: string | null;
  boxHostName: string | null;
  boxFilled: number | null;
  boxCapacity: number | null;
};

import type { Order, Ticket, WalletTicket } from "../domain/Ticket";
import type { Result } from "@/server/_shared/result";

// Quién escanea: el organizador tiene profile (membership); el portero por
// código tiene sesión (sin profile). Se registra uno u otro en scan_events.
export type ScannerRef = { profileId: string | null; sessionId: string | null };

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
  /** Asigna/edita el titular de una entrada propia (reparto post-compra). Solo
      el dueño actual y solo si está active. dniLast2 = últimos 2 dígitos. */
  setHolder(input: {
    ticketId: string;
    ownerId: string;
    holderName: string | null;
    // undefined = no tocar el DNI guardado; null = limpiarlo; string = setearlo.
    dniLast2: string | null | undefined;
  }): Promise<Result<Ticket>>;
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
  // `opts.zoneId` = puerta activa del portero. Si se pasa y la entrada no
  // pertenece a esa puerta (custom), devuelve err("wrong_zone") SIN marcar.
  // null/undefined o puerta principal → valida todas. No se aplica en el sync.
  markUsedByQr(
    qrCode: string,
    scanner: ScannerRef,
    opts?: { usedAt?: Date; zoneId?: string | null },
  ): Promise<Result<MarkUsedResult>>;
  /** Admisión confiable por ticketId (alta manual o sync de scan ya verificado). */
  markUsedByTicketId(
    ticketId: string,
    scanner: ScannerRef,
    opts?: { usedAt?: Date },
  ): Promise<Result<MarkUsedResult>>;
  /**
   * Calcula el alcance del carrusel de entradas para un ticket dado.
   * - Si el ticket pertenece a un box (host o acompañante): devuelve los IDs de
   *   los QR individuales que el host maneja (su entrada + acompañantes sin celular).
   * - Si no es box: devuelve las entradas activas del mismo evento que posee el
   *   viewer (excluye tickets de box), más el ticket actual aunque no esté active.
   * Incluye `eventTicketCount` para saber si mostrar "Ver todas" (event-scoped,
   * no el conteo del box) sin necesitar datos extra en el frontend.
   */
  getCarouselScope(
    ticketId: string,
    viewerId: string,
  ): Promise<Result<{ ids: string[]; currentIndex: number; eventTicketCount: number }>>;
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

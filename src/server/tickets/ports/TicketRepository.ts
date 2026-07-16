import type { Order, OrderQuote, Ticket, WalletTicket } from "../domain/Ticket";
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
  /** SOLO uso interno (issueCourtesy): fuerza precio 0 y marca la orden como
      cortesía. El endpoint público de compra nunca lo acepta (buySchema no lo
      incluye, zod lo descarta). */
  courtesy?: boolean;
  /** Respuestas del comprador a events.customFields (estilo Luma). Keyed por
      field.id — ver @/lib/events/customFields, único módulo con el shape. */
  customFieldAnswers?: Record<string, string | string[] | boolean> | null;
};

export type CourtesyInput = {
  eventId: string;
  ticketTypeId: string;
  qty: number;
  guest: { email?: string | null; phone?: string | null; fullName: string };
};

/** Read-model de una cortesía enviada, para la lista del panel del organizador. */
export type CourtesySummary = {
  orderId: string;
  createdAt: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  ticketTypeName: string;
  kind: string;
  boxLabel: string | null;
  /** Entradas emitidas al beneficiario (box = 1, la del host). */
  ticketCount: number;
  /** Personas que ya ingresaron (incluye invitados del box). */
  usedCount: number;
};

export type BuyOutput = {
  order: Order;
  tickets: Ticket[];
  preference: { id: string; initPoint: string };
  /** Token firmado (HMAC) de la orden. Llave que el cliente conserva para leer
      el estado de su propia compra (polling de /processing) sin sesión — clave
      para el guest que paga con Yape sin email. Lo adjunta el controller. */
  orderToken?: string;
};

export type QuoteInput = {
  eventId: string;
  items: Array<{ ticketTypeId: string; qty: number }>;
};

/** Fila de la bandeja de aprobación (RSVP con aprobación, ver ticket_types.requires_approval). */
export type PendingApproval = {
  orderId: string;
  createdAt: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  ticketTypeName: string;
  customFieldAnswers: Record<string, string | string[] | boolean>;
};

export interface TicketRepository {
  buy(input: BuyInput): Promise<Result<BuyOutput>>;
  /** Inscripciones pendientes de aprobación de un evento (más antiguas primero). */
  listPendingApprovals(eventId: string): Promise<Result<PendingApproval[]>>;
  /** Aprueba: orden→paid, tickets→active, se despacha el QR. */
  approveRegistration(orderId: string, eventId: string): Promise<Result<{ orderId: string }>>;
  /** Rechaza: orden→rejected, tickets→void. No hay reembolso (siempre es gratis). */
  rejectRegistration(orderId: string, eventId: string): Promise<Result<{ orderId: string }>>;
  /** Emite una cortesía del organizador: misma tubería que buy() pero a S/0
      (sin Mercado Pago, paid inmediato, envío del link de entrega por
      email/WhatsApp). El DNI del beneficiario se captura cuando reclama. */
  issueCourtesy(input: CourtesyInput): Promise<Result<BuyOutput>>;
  listCourtesies(eventId: string): Promise<Result<CourtesySummary[]>>;
  /** Cotiza un pedido con el MISMO cálculo que buy() (precio activo + promos +
      fee). Read-only: no reserva stock ni crea orden. */
  quote(input: QuoteInput): Promise<Result<OrderQuote>>;
  listMine(buyerId: string): Promise<WalletTicket[]>;
  /** Equivalente a llamar listMine() por cada titular en `holderIds`, en una
      sola query — para recuperación de entradas de una orden grupal (varios
      current_holder). */
  listManyByHolders(holderIds: string[]): Promise<WalletTicket[]>;
  getById(ticketId: string, buyerId: string): Promise<WalletTicket | null>;
  /** Asigna/edita el titular de una entrada propia (reparto post-compra). Solo
      el dueño actual y solo si está active. dni = DNI completo (se cifra y se
      derivan last4/last2 server-side). */
  setHolder(input: {
    ticketId: string;
    ownerId: string;
    holderName: string | null;
    // undefined = no tocar el DNI guardado; null = limpiarlo; string = setearlo (DNI completo).
    dni: string | null | undefined;
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
  }): Promise<Result<{ event: { title: string; startsAt: string } }>>;
  /** Reclama una transferencia pendiente: el ticket pasa a `toProfile`. Captura
      la identidad del holder real (nombre + DNI completo) en SU ticket. */
  claimTransfer(input: {
    token: string;
    toProfile: string;
    fullName?: string | null;
    dni?: string | null;
  }): Promise<Result<{ ticket: Ticket; eventSlug: string }>>;
  /** Reclama la PROPIA compra al loguearse tras pagar como invitado: reasigna
      `current_holder` de las entradas de la orden al `toProfile`. Idempotente;
      bloquea re-claim por otra cuenta una vez enganchada. No es transferencia
      entre personas (no consume `transfer_count`). */
  claimOrder(input: {
    orderId: string;
    toProfile: string;
  }): Promise<Result<{ ticketsClaimed: number; eventSlug: string; firstTicketId: string | null }>>;
  /** Cancela el envío pendiente del ticket (el emisor lo recupera al instante).
      El link enviado deja de servir. */
  cancelPendingTransfer(input: {
    ticketId: string;
    fromProfile: string;
  }): Promise<Result<{ ok: true }>>;
  // `opts.zoneId` = puerta activa del portero. Si se pasa y la entrada no
  // pertenece a esa puerta (custom), devuelve err("wrong_zone") SIN marcar.
  // null/undefined o puerta principal → valida todas. No se aplica en el sync.
  // `opts.expectedEventId` = evento de la sesión del portero; si el ticket
  // resuelto pertenece a otro evento, devuelve err("wrong_event") SIN marcar.
  markUsedByQr(
    qrCode: string,
    scanner: ScannerRef,
    opts?: { usedAt?: Date; zoneId?: string | null; expectedEventId?: string },
  ): Promise<Result<MarkUsedResult>>;
  /** Admisión confiable por ticketId (alta manual o sync de scan ya verificado). */
  markUsedByTicketId(
    ticketId: string,
    scanner: ScannerRef,
    opts?: { usedAt?: Date; expectedEventId?: string; zoneId?: string | null },
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
  /** Registra una solicitud de reembolso (tabla `refunds`, status "requested").
      No procesa el reembolso — eso lo hace el equipo a mano tras el correo de
      aviso. Solo el dueño actual del ticket puede solicitarlo, la entrada debe
      seguir "active" (una ya usada/anulada no aplica), y su orden debe tener un
      pago (`payments`) — pedidos gratis/cortesía no aplican.
      Idempotente: si ya hay una solicitud pendiente para ese pago, devuelve el
      resumen con `alreadyRequested: true` en vez de duplicar fila + correo.
      Errores posibles: `ticket_not_found`, `not_owner`, `ticket_not_refundable`,
      `no_payment_found`. */
  requestRefund(input: {
    ticketId: string;
    profileId: string;
    reason: string;
  }): Promise<Result<RefundRequestSummary>>;
}

/** Datos para el correo de aviso a team@pasape.lat tras una solicitud. */
export type RefundRequestSummary = {
  orderId: string;
  eventTitle: string;
  amountCents: number;
  currency: string;
  buyerName: string | null;
  buyerEmail: string | null;
  /** true si ya existía una solicitud pendiente para ese pago — el caso de uso
      omite el correo y la UI muestra un toast "ya solicitaste" en vez del flujo
      de éxito normal. */
  alreadyRequested: boolean;
};

export type MarkUsedResult = {
  ticket: Ticket;
  eventId: string;
  holderName: string | null;
  holderDniLast4: string | null;
  ticketTypeName: string | null;
  boxLabel: string | null;
  boxHostName: string | null;
  boxFilled: number | null;
  boxCapacity: number | null;
};

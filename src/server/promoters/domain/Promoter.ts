export type PromoterLink = {
  id: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventStartsAt: string;
  eventVenue: string | null;
  // `promoterId` es null cuando el link viene de un org_promoter del pool
  // que aún no firmó cuenta Pasape. Al firmar con OTP se completa.
  promoterId: string | null;
  orgPromoterId: string | null;
  code: string;
  commissionPct: number;
  active: boolean;
  createdAt: string;
  /**
   * Cupo de cortesías de la lista de invitados para este promotor.
   * null = sin tope individual (solo lo limita el cupo total del evento).
   */
  guestListQuota: number | null;
  /** Backend-computed: estado del evento relativo al momento de fetch. */
  eventStatus: "live" | "upcoming" | "closed";
};

export type PromoterEventEarning = {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventStartsAt: string;
  ticketsSold: number;
  grossCents: number;
  commissionPct: number;
  commissionCents: number;
  payoutStatus: "pending" | "paid" | "void" | "none";
};

export type RecentBuyer = {
  firstName: string;
  createdAt: string;
};

export type PromoterHomeData = {
  link: PromoterLink;
  soldCount: number;
  recent: RecentBuyer[];
};

// Un invitado de la lista del promotor: una cortesía (ticket S/0) que él emitió.
// `enteredAt` no es null cuando el invitado ya pasó por puerta (status 'used').
export type PromoterGuest = {
  ticketId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: "active" | "used" | "void" | "refunded";
  enteredAt: string | null;
  createdAt: string;
};

export type PromoterApplication = {
  id: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  applicantId: string;
  applicantName: string;
  applicantHandle: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  message: string | null;
  createdAt: string;
};

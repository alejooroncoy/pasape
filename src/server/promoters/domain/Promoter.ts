import type { CommissionConfig, CommissionType } from "./OrgPromoter";

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
  // ── Cómo le pagan (resuelto: link → evento → marca) ──
  /** Modalidad efectiva: % por venta, hitos en efectivo o premios en especie. */
  commissionType: CommissionType;
  /** % efectivo (relevante solo si commissionType === "percentage"). */
  commissionPct: number;
  /** Config de hitos/especie efectiva (null si es %). */
  commissionConfig: CommissionConfig;
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

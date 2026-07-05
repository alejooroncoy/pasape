import type { CommissionConfig } from "./OrgPromoter";

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
  /** % efectivo por venta (0 = sin comisión por venta). */
  commissionPct: number;
  /** Dinero: % del vendido + hitos cash conseguidos. */
  commissionCents: number;
  payoutStatus: "pending" | "paid" | "void" | "none";
  /** Hitos del esquema y cuántos ya se consiguieron (para "X/Y hitos"). */
  totalMilestones: number;
  unlockedMilestones: number;
};

export type RecentBuyer = {
  firstName: string;
  createdAt: string;
};

export type PromoterHomeData = {
  link: PromoterLink;
  /** Entradas vendidas (pago). Unidad de las metas con basis "sold". */
  soldCount: number;
  /** Entradas validadas en puerta (gratis+pago). Unidad de las metas con
   *  basis "attended" — el promotor solo avanza cuando su gente entra. */
  attendedCount: number;
  recent: RecentBuyer[];
  // ── Cómo le pagan (resuelto: link → evento → marca). Dos ejes: ──
  /** % efectivo por venta (0 = sin comisión por venta). */
  commissionPct: number;
  /** Metas efectivas (efectivo/especie por umbral). null = sin metas. */
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

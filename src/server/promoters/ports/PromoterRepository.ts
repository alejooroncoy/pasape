import type { Result } from "@/server/_shared/result";
import type {
  PromoterApplication,
  PromoterEventEarning,
  PromoterGuest,
  PromoterHomeData,
  PromoterLink,
} from "../domain/Promoter";

export type PromoterRepository = {
  listMyLinks(promoterId: string): Promise<PromoterLink[]>;
  getHomeData(promoterId: string, slug: string): Promise<PromoterHomeData | null>;
  /** Invitados (cortesías) que el promotor emitió por este link. */
  listGuests(linkId: string): Promise<PromoterGuest[]>;
  getEarnings(promoterId: string): Promise<PromoterEventEarning[]>;
  generateInviteToken(input: {
    eventSlug: string;
    orgId: string;
    commissionPct: number;
  }): Promise<Result<{ token: string; url: string }>>;
  resolveInviteToken(token: string): Promise<{ eventId: string; eventSlug: string; eventTitle: string; commissionPct: number; orgName: string } | null>;
  applyByToken(input: {
    token: string;
    applicantId: string;
    message: string | null;
  }): Promise<Result<{ applicationId: string; eventSlug: string }>>;
  getApplicationStatus(
    applicantId: string,
    eventSlug: string,
  ): Promise<{ status: "pending" | "approved" | "rejected" | "cancelled"; link: PromoterLink | null } | null>;
  listPendingApplications(eventSlug: string, orgId: string): Promise<PromoterApplication[]>;
  decideApplication(input: {
    applicationId: string;
    decidedBy: string;
    orgId: string;
    decision: "approved" | "rejected";
    commissionPct: number;
  }): Promise<Result<{ link: PromoterLink | null }>>;
};

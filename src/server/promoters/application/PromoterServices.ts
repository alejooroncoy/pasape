import type { PromoterRepository } from "../ports/PromoterRepository";
import type {
  PromoterApplication,
  PromoterEventEarning,
  PromoterHomeData,
  PromoterLink,
} from "../domain/Promoter";

type Deps = { repo: PromoterRepository };

export const listMyLinks = ({ repo }: Deps, promoterId: string): Promise<PromoterLink[]> =>
  repo.listMyLinks(promoterId);

export const getHomeData = (
  { repo }: Deps,
  promoterId: string,
  slug: string,
): Promise<PromoterHomeData | null> => repo.getHomeData(promoterId, slug);

export const getMyEarnings = (
  { repo }: Deps,
  promoterId: string,
): Promise<PromoterEventEarning[]> => repo.getEarnings(promoterId);

export const generateInviteToken = (
  { repo }: Deps,
  input: { eventSlug: string; orgId: string; commissionPct: number },
) => repo.generateInviteToken(input);

export const resolveInviteToken = ({ repo }: Deps, token: string) =>
  repo.resolveInviteToken(token);

export const applyByLink = (
  { repo }: Deps,
  input: { token: string; applicantId: string; message: string | null; name?: string | null },
) => repo.applyByToken(input);

export const getApplicationStatus = (
  { repo }: Deps,
  applicantId: string,
  eventSlug: string,
) => repo.getApplicationStatus(applicantId, eventSlug);

export const listPendingApplications = (
  { repo }: Deps,
  eventSlug: string,
  orgId: string,
): Promise<PromoterApplication[]> => repo.listPendingApplications(eventSlug, orgId);

export const decideApplication = (
  { repo }: Deps,
  input: {
    applicationId: string;
    decidedBy: string;
    orgId: string;
    decision: "approved" | "rejected";
    commissionPct?: number | null;
  },
) => repo.decideApplication(input);

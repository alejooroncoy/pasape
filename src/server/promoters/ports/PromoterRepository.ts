import type { Result } from "@/server/_shared/result";
import type {
  PromoterApplication,
  PromoterEventEarning,
  PromoterHomeData,
  PromoterLink,
} from "../domain/Promoter";

export type PromoterRepository = {
  listMyLinks(promoterId: string): Promise<PromoterLink[]>;
  getHomeData(promoterId: string, slug: string): Promise<PromoterHomeData | null>;
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
    // Nombre editado en /apply (LOW-11): si viene, actualiza profiles.full_name
    // del postulante — el organizador ve ese nombre en la lista de solicitudes.
    name?: string | null;
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
    // Opcional: si se omite, el link se crea SIN % propio y hereda el esquema
    // del evento (ver resolveCommissionScheme). Solo se pasa para overridear a
    // un promotor puntual.
    commissionPct?: number | null;
  }): Promise<Result<{ link: PromoterLink | null }>>;
};

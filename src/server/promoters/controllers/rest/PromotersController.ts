import { z } from "zod";
import { err, type Result } from "@/server/_shared/result";
import { getAuthContext, resolveActiveOrgSlug } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { supabasePromoterRepository as repo } from "../../infrastructure/repositories/SupabasePromoterRepository";
import {
  applyByLink,
  decideApplication,
  generateInviteToken,
  getApplicationStatus,
  getHomeData,
  getMyEarnings,
  listMyLinks,
  listPendingApplications,
  resolveInviteToken,
} from "../../application/PromoterServices";
import type {
  PromoterApplication,
  PromoterEventEarning,
  PromoterHomeData,
  PromoterLink,
} from "../../domain/Promoter";

const generateSchema = z.object({
  eventSlug: z.string().min(1),
  commissionPct: z.number().int().min(0).max(100).default(15),
});

const applySchema = z.object({
  token: z.string().min(1),
  message: z.string().nullable().optional(),
  fullName: z.string().trim().min(1).max(120).nullable().optional(),
});

const decideSchema = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  // Sin default: si no llega, el promotor hereda la comisión del evento. Solo
  // se envía para overridear a alguien puntual (el "caso raro").
  commissionPct: z.number().int().min(0).max(100).optional(),
});

const orgFromActive = async (profileId: string) => {
  const slug = await resolveActiveOrgSlug(profileId);
  if (!slug) return null;
  return supabaseOrganizationRepository.findBySlug(slug);
};

// Aprobar/rechazar postulantes y emitir links de invitación fija comisiones
// (dinero) — exigir rol de gestión, no solo membresía, igual que
// OrgPromotersController.ORG_WRITE_ROLES.
const ORG_WRITE_ROLES = ["owner", "admin", "editor"];

const hasWriteRole = async (orgId: string, profileId: string): Promise<boolean> => {
  const { data: membership } = await supabaseAdmin()
    .from("memberships")
    .select("role")
    .eq("scope_type", "organization")
    .eq("scope_id", orgId)
    .eq("profile_id", profileId)
    .maybeSingle<{ role: string }>();
  return !!membership && ORG_WRITE_ROLES.includes(membership.role);
};

export const PromotersController = {
  async myLinks(): Promise<Result<PromoterLink[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return { ok: true, value: await listMyLinks({ repo }, auth.value.profileId) };
  },

  async home(slug: string): Promise<Result<PromoterHomeData>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const home = await getHomeData({ repo }, auth.value.profileId, slug);
    if (!home) return err("not_found");
    return { ok: true, value: home };
  },

  async earnings(): Promise<Result<PromoterEventEarning[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return { ok: true, value: await getMyEarnings({ repo }, auth.value.profileId) };
  },

  async generate(input: unknown): Promise<Result<{ token: string; url: string }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const org = await orgFromActive(auth.value.profileId);
    if (!org) return err("no_active_org");
    if (!(await hasWriteRole(org.id, auth.value.profileId))) return err("forbidden");
    const parsed = generateSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return generateInviteToken(
      { repo },
      { eventSlug: parsed.data.eventSlug, orgId: org.id, commissionPct: parsed.data.commissionPct },
    );
  },

  async resolveToken(token: string) {
    const data = await resolveInviteToken({ repo }, token);
    if (!data) return err("invalid_token");
    return { ok: true as const, value: data };
  },

  async apply(input: unknown) {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = applySchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return applyByLink(
      { repo },
      {
        token: parsed.data.token,
        applicantId: auth.value.profileId,
        message: parsed.data.message ?? null,
        fullName: parsed.data.fullName ?? null,
      },
    );
  },

  async status(eventSlug: string) {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const s = await getApplicationStatus({ repo }, auth.value.profileId, eventSlug);
    if (!s) return err("not_found");
    return { ok: true as const, value: s };
  },

  async pending(eventSlug: string): Promise<Result<PromoterApplication[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const org = await orgFromActive(auth.value.profileId);
    if (!org) return err("no_active_org");
    if (!(await hasWriteRole(org.id, auth.value.profileId))) return err("forbidden");
    return { ok: true, value: await listPendingApplications({ repo }, eventSlug, org.id) };
  },

  async decide(input: unknown) {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const org = await orgFromActive(auth.value.profileId);
    if (!org) return err("no_active_org");
    if (!(await hasWriteRole(org.id, auth.value.profileId))) return err("forbidden");
    const parsed = decideSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return decideApplication(
      { repo },
      {
        applicationId: parsed.data.applicationId,
        decidedBy: auth.value.profileId,
        orgId: org.id,
        decision: parsed.data.decision,
        commissionPct: parsed.data.commissionPct,
      },
    );
  },
};

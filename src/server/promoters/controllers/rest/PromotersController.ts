import { z } from "zod";
import { err, type Result } from "@/server/_shared/result";
import { getAuthContext, resolveActiveOrgSlug } from "@/server/_shared/AuthContext";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { supabasePromoterRepository as repo } from "../../infrastructure/repositories/SupabasePromoterRepository";
import { supabaseEventRepository as eventRepo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { supabaseTicketRepository as ticketRepo } from "@/server/tickets/infrastructure/repositories/SupabaseTicketRepository";
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
import { addGuest, listGuests } from "../../application/GuestList";
import type {
  PromoterApplication,
  PromoterEventEarning,
  PromoterGuest,
  PromoterHomeData,
  PromoterLink,
} from "../../domain/Promoter";

const guestDeps = { promoterRepo: repo, eventRepo, ticketRepo };

const addGuestSchema = z
  .object({
    name: z.string().min(2),
    dni: z.string().min(8).max(8),
    email: z.string().email().nullable().optional(),
    phone: z.string().min(6).nullable().optional(),
  })
  .refine((g) => !!g.email || !!g.phone, {
    message: "guest_contact_required",
    path: ["phone"],
  });

const generateSchema = z.object({
  eventSlug: z.string().min(1),
  commissionPct: z.number().int().min(0).max(100).default(15),
});

const applySchema = z.object({
  token: z.string().min(1),
  message: z.string().nullable().optional(),
});

const decideSchema = z.object({
  applicationId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  commissionPct: z.number().int().min(0).max(100).default(15),
});

const orgFromActive = async (profileId: string) => {
  const slug = await resolveActiveOrgSlug(profileId);
  if (!slug) return null;
  return supabaseOrganizationRepository.findBySlug(slug);
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
      { token: parsed.data.token, applicantId: auth.value.profileId, message: parsed.data.message ?? null },
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
    return { ok: true, value: await listPendingApplications({ repo }, eventSlug, org.id) };
  },

  async decide(input: unknown) {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const org = await orgFromActive(auth.value.profileId);
    if (!org) return err("no_active_org");
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

  async guests(slug: string): Promise<Result<PromoterGuest[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return listGuests(guestDeps, auth.value.profileId, slug);
  },

  async addGuest(slug: string, input: unknown): Promise<Result<{ ticketId: string }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = addGuestSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return addGuest(guestDeps, auth.value.profileId, slug, parsed.data);
  },
};

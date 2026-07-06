import { z } from "zod";
import { cookies } from "next/headers";
import { err, type Result } from "@/server/_shared/result";
import { ACTIVE_ORG_COOKIE, getAuthContext, resolveActiveOrgSlug } from "@/server/_shared/AuthContext";
import { getCurrentUser } from "../../application/GetCurrentUser";
import { completeOnboarding } from "../../application/CompleteOnboarding";
import { updateProfile } from "../../application/UpdateProfile";
import { listNotifications, type Notification } from "../../application/ListNotifications";
import { listFollows, type FollowedOrg } from "../../application/ListFollows";
import { followOrg, unfollowOrg } from "../../application/ToggleFollow";
import { listSavedEvents, type SavedEvent } from "@/server/events/application/ListSavedEvents";
import { saveEvent, unsaveEvent } from "@/server/events/application/ToggleSaveEvent";
import { lookupProfileByPhone, type LookupResult } from "../../application/LookupProfile";
import { supabaseUserRepository } from "../../infrastructure/repositories/SupabaseUserRepository";
import { supabaseOrganizationRepository } from "../../organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { supabaseLegalEntityRepository } from "../../organizations/infrastructure/repositories/SupabaseLegalEntityRepository";
import type { User } from "../../domain/User";

const repo = supabaseUserRepository;
const orgRepo = supabaseOrganizationRepository;
const legalEntityRepo = supabaseLegalEntityRepository;

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(6).nullable().optional(),
  dni: z.string().min(6).max(20).nullable().optional(),
  organizerType: z
    .enum(["production_company", "venue_owner", "independent_host"])
    .nullable()
    .optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

const onboardingSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(6).nullable().optional(),
  dni: z.string().min(6).max(20).nullable().optional(),
  initialRole: z.enum(["buyer", "promoter", "organizer"]).default("buyer"),
  entityName: z.string().min(1).max(160).nullable().optional(),
  entityTaxId: z.string().min(6).max(20).nullable().optional(),
  brandName: z.string().min(1).max(120).nullable().optional(),
});

export const IdentityController = {
  async me(): Promise<Result<{ user: User; activeOrgSlug: string | null } | null>> {
    const auth = await getAuthContext();
    if (auth.ok) {
      const user = await getCurrentUser({ repo }, auth.value.profileId);
      if (user) {
        // Fuente de verdad = perfil (cross-device), no la cookie cruda.
        const slug = await resolveActiveOrgSlug(auth.value.profileId);
        return { ok: true, value: { user, activeOrgSlug: slug } };
      }
    }
    return { ok: true, value: null };
  },

  async completeOnboarding(input: unknown): Promise<Result<{ orgSlug: string | null }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = onboardingSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    const result = await completeOnboarding(
      { orgRepo, legalEntityRepo },
      {
        profileId: auth.value.profileId,
        fullName: parsed.data.fullName,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        dni: parsed.data.dni ?? null,
        initialRole: parsed.data.initialRole,
        entityName: parsed.data.entityName ?? null,
        entityTaxId: parsed.data.entityTaxId ?? null,
        brandName: parsed.data.brandName ?? null,
      },
    );
    if (!result.ok) return err(result.error);
    if (result.value.orgSlug) {
      const store = await cookies();
      store.set(ACTIVE_ORG_COOKIE, result.value.orgSlug, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return { ok: true, value: { orgSlug: result.value.orgSlug } };
  },

  async updateProfile(input: unknown): Promise<Result<User>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return updateProfile({
      profileId: auth.value.profileId,
      fullName: parsed.data.fullName ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      dni: parsed.data.dni ?? null,
      organizerType: parsed.data.organizerType,
      avatarUrl: parsed.data.avatarUrl,
    });
  },

  async listNotifications(): Promise<Result<Notification[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return listNotifications(auth.value.profileId);
  },

  async listFollows(): Promise<Result<FollowedOrg[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return listFollows(auth.value.profileId);
  },

  async follow(input: unknown): Promise<Result<{ following: true }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = z.object({ organizationId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return followOrg(auth.value.profileId, parsed.data.organizationId);
  },

  async unfollow(input: unknown): Promise<Result<{ following: false }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = z.object({ organizationId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return unfollowOrg(auth.value.profileId, parsed.data.organizationId);
  },

  async listSavedEvents(): Promise<Result<SavedEvent[]>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return listSavedEvents(auth.value.profileId);
  },

  async saveEvent(input: unknown): Promise<Result<{ saved: true }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = z.object({ eventId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return saveEvent(auth.value.profileId, parsed.data.eventId);
  },

  async unsaveEvent(input: unknown): Promise<Result<{ saved: false }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = z.object({ eventId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return unsaveEvent(auth.value.profileId, parsed.data.eventId);
  },

  // Lookup pública por WhatsApp — usada para confirmar al destinatario al que
  // le mandas una entrada (estilo Yape). Sin autenticación pero solo expone
  // displayName corto (privacy-preserving).
  async lookupByPhone(input: unknown): Promise<Result<LookupResult>> {
    const parsed = z.object({ phone: z.string().min(9) }).safeParse(input);
    if (!parsed.success) return { ok: true, value: { displayHint: "WhatsApp verificado" } };
    const result = await lookupProfileByPhone(parsed.data.phone);
    return { ok: true, value: result };
  },
};

import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { Role, User } from "../domain/User";
import type { OrganizationRepository } from "../organizations/ports/OrganizationRepository";
import type { LegalEntityRepository } from "../organizations/ports/LegalEntityRepository";
import { createOrganization } from "../organizations/application/CreateOrganization";
import { createLegalEntity } from "../organizations/application/CreateLegalEntity";

type Deps = { orgRepo: OrganizationRepository; legalEntityRepo: LegalEntityRepository };

type Input = {
  profileId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  dni: string | null;
  initialRole: Role;
  // Organizer-only: si vienen, creamos legal_entity + organization con
  // estos nombres en vez del placeholder. Si no, mantenemos el legacy
  // que usa fullName.
  entityName?: string | null;
  entityTaxId?: string | null;
  brandName?: string | null;
};

export const completeOnboarding = async (
  { orgRepo, legalEntityRepo }: Deps,
  input: Input,
): Promise<Result<{ user: User; orgSlug: string | null }>> => {
  const db = supabaseAdmin();

  const { data: profile, error: pErr } = await db
    .from("profiles")
    .update({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      initial_role: input.initialRole,
    })
    .eq("id", input.profileId)
    .select("*")
    .single();
  if (pErr || !profile) return err(pErr?.message ?? "profile_update_failed");

  if (input.dni) {
    const last2 = input.dni.slice(-2);
    const { error: kycErr } = await db.from("kyc_documents").upsert(
      {
        profile_id: input.profileId,
        doc_kind: "dni",
        doc_number: input.dni,
        last2,
      },
      { onConflict: "profile_id,doc_kind" },
    );
    if (kycErr) return err(kycErr.message);
  }

  let orgSlug: string | null = null;
  if (input.initialRole === "organizer") {
    const existing = await orgRepo.listByMember(input.profileId);
    if (existing.length === 0) {
      const entityName =
        input.entityName?.trim() || input.fullName || "Mi razón social";
      const brandName =
        input.brandName?.trim() || input.entityName?.trim() || input.fullName || "Mi marca";
      const entity = await createLegalEntity(
        { repo: legalEntityRepo },
        {
          name: entityName,
          taxId: input.entityTaxId?.trim() || null,
          createdBy: input.profileId,
        },
      );
      if (!entity.ok) return err(entity.error);

      const created = await createOrganization(
        { repo: orgRepo, legalEntities: legalEntityRepo },
        {
          name: brandName,
          legalEntityId: entity.value.id,
          createdBy: input.profileId,
        },
      );
      if (!created.ok) return err(created.error);
      orgSlug = created.value.slug;
    } else {
      orgSlug = existing[0].slug;
    }
  }

  return ok({
    user: {
      id: profile.id,
      email: profile.email,
      phone: profile.phone,
      fullName: profile.full_name,
      dni: input.dni ?? null,
      avatarUrl: profile.avatar_url,
      initialRole: profile.initial_role,
      organizerType: profile.organizer_type ?? null,
      createdAt: profile.created_at,
    },
    orgSlug,
  });
};

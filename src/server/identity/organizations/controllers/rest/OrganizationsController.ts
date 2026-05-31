import { z } from "zod";
import { err, type Result } from "@/server/_shared/result";
import { getAuthContext, ACTIVE_ORG_COOKIE } from "@/server/_shared/AuthContext";
import { cookies } from "next/headers";
import { createOrganization } from "../../application/CreateOrganization";
import { listMyOrgs } from "../../application/ListMyOrgs";
import { switchActiveOrg } from "../../application/SwitchActiveOrg";
import { createLegalEntity } from "../../application/CreateLegalEntity";
import { supabaseOrganizationRepository } from "../../infrastructure/repositories/SupabaseOrganizationRepository";
import { supabaseLegalEntityRepository } from "../../infrastructure/repositories/SupabaseLegalEntityRepository";
import type { Organization, OrgRole } from "../../domain/Organization";

const repo = supabaseOrganizationRepository;
const legalEntities = supabaseLegalEntityRepository;

const setActiveCookie = async (slug: string) => {
  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
};

const createSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().optional(),
    logoUrl: z.string().nullable().optional(),
    legalEntityId: z.string().uuid().optional(),
    newLegalEntity: z
      .object({
        name: z.string().min(1),
        taxId: z.string().nullable().optional(),
        country: z.string().length(2).optional(),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.legalEntityId) || Boolean(v.newLegalEntity), {
    message: "legal_entity_required",
  });

// Slug: minúsculas, números y guiones. Coincide con cómo se genera al crear.
const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(2).max(40).regex(slugRe, "slug_invalid").optional(),
  logoUrl: z.string().nullable().optional(),
  brandColor: z.string().nullable().optional(),
  description: z.string().max(160).nullable().optional(),
  // Acepta con o sin @, lo normalizamos al handle limpio.
  instagram: z
    .string()
    .max(40)
    .nullable()
    .optional()
    .transform((v) => (v == null ? v : v.trim().replace(/^@+/, "") || null)),
});

export const OrganizationsController = {
  async list(): Promise<Result<Array<Organization & { role: OrgRole }>>> {
    const auth = await getAuthContext();
    if (auth.ok) {
      const orgs = await listMyOrgs({ repo }, auth.value.profileId);
      return { ok: true, value: orgs };
    }
    return err(auth.error);
  },

  async create(input: unknown): Promise<Result<{ id: string; slug: string }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");

    let legalEntityId = parsed.data.legalEntityId;
    if (!legalEntityId && parsed.data.newLegalEntity) {
      const created = await createLegalEntity(
        { repo: legalEntities },
        { ...parsed.data.newLegalEntity, createdBy: auth.value.profileId },
      );
      if (!created.ok) return err(created.error);
      legalEntityId = created.value.id;
    }
    if (!legalEntityId) return err("legal_entity_required");

    const result = await createOrganization(
      { repo, legalEntities },
      {
        name: parsed.data.name,
        slug: parsed.data.slug,
        logoUrl: parsed.data.logoUrl,
        legalEntityId,
        createdBy: auth.value.profileId,
      },
    );
    if (!result.ok) return result;
    await setActiveCookie(result.value.slug);
    return { ok: true, value: { id: result.value.id, slug: result.value.slug } };
  },

  async switchActive(input: unknown): Promise<Result<{ slug: string }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = z.object({ slug: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return err("invalid_input");
    const result = await switchActiveOrg(
      { repo },
      { profileId: auth.value.profileId, orgSlug: parsed.data.slug },
    );
    if (!result.ok) return result;
    await setActiveCookie(result.value.slug);
    return result;
  },

  async update(slug: string, input: unknown): Promise<Result<Organization>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");

    const org = await repo.findBySlug(slug);
    if (!org) return err("org_not_found");

    const result = await repo.update({
      id: org.id,
      callerId: auth.value.profileId,
      name: parsed.data.name,
      slug: parsed.data.slug,
      logoUrl: parsed.data.logoUrl,
      brandColor: parsed.data.brandColor,
      description: parsed.data.description,
      instagram: parsed.data.instagram,
    });
    if (!result.ok) return result;
    // Si cambió el slug y era la org activa, refresca la cookie.
    if (parsed.data.slug && parsed.data.slug !== slug) {
      const store = await cookies();
      if (store.get(ACTIVE_ORG_COOKIE)?.value === slug) {
        await setActiveCookie(result.value.slug);
      }
    }
    return result;
  },
};

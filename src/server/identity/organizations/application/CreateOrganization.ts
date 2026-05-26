import type { Result } from "@/server/_shared/result";
import { err } from "@/server/_shared/result";
import type { OrganizationRepository } from "../ports/OrganizationRepository";
import type { LegalEntityRepository } from "../ports/LegalEntityRepository";
import type { Organization } from "../domain/Organization";

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 40) || `org-${Math.random().toString(36).slice(2, 8)}`;

type Deps = { repo: OrganizationRepository; legalEntities: LegalEntityRepository };
type Input = {
  name: string;
  slug?: string;
  legalEntityId: string;
  createdBy: string;
  logoUrl?: string | null;
};

export const createOrganization = async (
  { repo, legalEntities }: Deps,
  input: Input,
): Promise<Result<Organization>> => {
  if (!input.name.trim()) return err("name_required");
  if (!input.legalEntityId) return err("legal_entity_required");

  const entity = await legalEntities.findById(input.legalEntityId);
  if (!entity) return err("legal_entity_not_found");
  if (entity.createdBy !== input.createdBy) return err("forbidden");

  const slug = input.slug?.trim() || slugify(input.name);
  const existing = await repo.findBySlug(slug);
  if (existing) return err("slug_taken");
  return repo.create({
    name: input.name.trim(),
    slug,
    legalEntityId: input.legalEntityId,
    createdBy: input.createdBy,
    logoUrl: input.logoUrl,
  });
};

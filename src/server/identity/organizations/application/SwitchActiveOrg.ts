import type { OrganizationRepository } from "../ports/OrganizationRepository";
import { err, ok, type Result } from "@/server/_shared/result";

type Deps = { repo: OrganizationRepository };
type Input = { profileId: string; orgSlug: string };

export const switchActiveOrg = async (
  { repo }: Deps,
  input: Input,
): Promise<Result<{ slug: string }>> => {
  const org = await repo.findBySlug(input.orgSlug);
  if (!org) return err("org_not_found");
  const memberships = await repo.listByMember(input.profileId);
  if (!memberships.some((m) => m.id === org.id)) return err("not_a_member");
  // Persiste la marca elegida en el perfil → se restaura en cualquier dispositivo.
  await repo.setLastActiveOrg(input.profileId, org.id);
  return ok({ slug: org.slug });
};

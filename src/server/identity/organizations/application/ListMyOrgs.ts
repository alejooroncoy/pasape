import type { OrganizationRepository } from "../ports/OrganizationRepository";

type Deps = { repo: OrganizationRepository };

export const listMyOrgs = ({ repo }: Deps, profileId: string) =>
  repo.listByMember(profileId);

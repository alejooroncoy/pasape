import type { LegalEntityRepository } from "../ports/LegalEntityRepository";

type Deps = { repo: LegalEntityRepository };

export const listMyLegalEntities = ({ repo }: Deps, profileId: string) =>
  repo.listByOwner(profileId);

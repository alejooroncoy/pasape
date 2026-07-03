import type {
  CommissionTierRepository,
  CreateCommissionTierInput,
  UpdateCommissionTierInput,
} from "../ports/CommissionTierRepository";

type Deps = { repo: CommissionTierRepository };

export const listTiersForLink = ({ repo }: Deps, linkId: string) =>
  repo.listForLink(linkId);

export const createTier = ({ repo }: Deps, input: CreateCommissionTierInput) =>
  repo.create(input);

export const updateTier = ({ repo }: Deps, input: UpdateCommissionTierInput) =>
  repo.update(input);

export const removeTier = ({ repo }: Deps, id: string, promoterLinkId: string) =>
  repo.remove(id, promoterLinkId);

export const recalcTierUnlocks = (
  { repo }: Deps,
  linkId: string,
  soldCount: number,
) => repo.recalcUnlocksForLink(linkId, soldCount);

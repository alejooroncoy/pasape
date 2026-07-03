import type { Result } from "@/server/_shared/result";
import type {
  CommissionRewardKind,
  CommissionTier,
} from "../domain/CommissionTier";

export type CreateCommissionTierInput = {
  promoterLinkId: string;
  thresholdCount: number;
  rewardKind: CommissionRewardKind;
  rewardAmountCents: number | null;
  rewardLabel: string;
};

export type UpdateCommissionTierInput = {
  id: string;
  /** Link al que DEBE pertenecer el tier (scoping anti-IDOR). El caller ya
   *  verificó la propiedad de este link; sin este filtro, un tierId de otra org
   *  se editaría igual porque el UPDATE solo casa por id. */
  promoterLinkId: string;
  thresholdCount?: number;
  rewardKind?: CommissionRewardKind;
  rewardAmountCents?: number | null;
  rewardLabel?: string;
};

export type LinkOwnership = {
  linkId: string;
  eventId: string;
  organizationId: string;
  promoterId: string;
};

export interface CommissionTierRepository {
  listForLink(linkId: string): Promise<CommissionTier[]>;
  create(input: CreateCommissionTierInput): Promise<Result<CommissionTier>>;
  update(input: UpdateCommissionTierInput): Promise<Result<CommissionTier>>;
  remove(id: string, promoterLinkId: string): Promise<Result<{ id: string }>>;
  /** Marca como unlocked todos los tiers cuyo umbral fue alcanzado. */
  recalcUnlocksForLink(
    linkId: string,
    soldCount: number,
  ): Promise<{ unlockedIds: string[] }>;
  /** Devuelve datos de propiedad del link para chequeos de auth. */
  ownershipOf(linkId: string): Promise<LinkOwnership | null>;
}

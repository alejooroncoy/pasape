export type CommissionRewardKind = "cash" | "bottle" | "custom";

export type CommissionTier = {
  id: string;
  promoterLinkId: string;
  thresholdCount: number;
  rewardKind: CommissionRewardKind;
  rewardAmountCents: number | null;
  rewardLabel: string;
  unlockedAt: string | null;
  createdAt: string;
};

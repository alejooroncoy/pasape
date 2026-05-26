export type CommissionType = "percentage" | "tiered" | "inkind";

export type CommissionTier = { salesCount: number; payoutCents: number };
export type CommissionReward = { salesCount: number; label: string; icon: string };

/**
 * Shape of `commission_config` jsonb column.
 *
 *  - `percentage` → null (the percent lives in `default_commission_pct`)
 *  - `tiered`     → { tiers: CommissionTier[] }
 *  - `inkind`     → { rewards: CommissionReward[] }
 */
export type CommissionConfig =
  | null
  | { tiers: CommissionTier[] }
  | { rewards: CommissionReward[] };

export type OrgPromoter = {
  id: string;
  organizationId: string;
  name: string;
  whatsapp: string | null;
  defaultCommissionPct: number;
  commissionType: CommissionType;
  commissionConfig: CommissionConfig;
  profileId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
};

export type CreateOrgPromoterInput = {
  organizationId: string;
  createdBy: string;
  name: string;
  whatsapp: string | null;
  defaultCommissionPct: number;
  commissionType: CommissionType;
  commissionConfig: CommissionConfig;
  notes?: string | null;
};

export type UpdateOrgPromoterInput = {
  name?: string;
  whatsapp?: string | null;
  defaultCommissionPct?: number;
  commissionType?: CommissionType;
  commissionConfig?: CommissionConfig;
  notes?: string | null;
};

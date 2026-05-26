import type {
  CommissionConfig,
  CommissionReward,
  CommissionTier,
  CommissionType,
} from "../domain/OrgPromoter";

export type PayoutInput = {
  type: CommissionType;
  config: CommissionConfig;
  pct: number;
  ticketsSold: number;
  grossCents: number;
};

export type PayoutResult = {
  /** Money to pay the promoter. For inkind this stays at 0 — rewards aren't cash. */
  payoutCents: number;
  /** Unlocked in-kind rewards (always [] for percentage/tiered). */
  rewards: Array<{ label: string; icon: string }>;
};

/**
 * Resolve a promoter's earnings for an event based on their commission scheme.
 *
 *   - percentage: round(gross * pct / 100)
 *   - tiered:     sum of payouts for every tier whose threshold has been reached
 *   - inkind:     0 cents; emit the list of rewards whose threshold has been reached
 *
 * Safe to call with any input: malformed configs simply yield 0 / [].
 */
export const computePromoterPayout = ({
  type,
  config,
  pct,
  ticketsSold,
  grossCents,
}: PayoutInput): PayoutResult => {
  if (type === "percentage") {
    return { payoutCents: Math.round((grossCents * pct) / 100), rewards: [] };
  }
  if (type === "tiered") {
    if (!config || !("tiers" in config)) return { payoutCents: 0, rewards: [] };
    const payoutCents = config.tiers.reduce(
      (acc: number, t: CommissionTier) =>
        ticketsSold >= t.salesCount ? acc + t.payoutCents : acc,
      0,
    );
    return { payoutCents, rewards: [] };
  }
  // inkind
  if (!config || !("rewards" in config)) return { payoutCents: 0, rewards: [] };
  const rewards = config.rewards
    .filter((r: CommissionReward) => ticketsSold >= r.salesCount)
    .map((r: CommissionReward) => ({ label: r.label, icon: r.icon }));
  return { payoutCents: 0, rewards };
};

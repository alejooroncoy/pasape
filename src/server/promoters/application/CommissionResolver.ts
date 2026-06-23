import type {
  CommissionConfig,
  CommissionReward,
  CommissionTier,
  CommissionType,
} from "../domain/OrgPromoter";

/**
 * Coerce a raw jsonb `commission_config` into the typed shape, given the
 * resolved commission type. Any malformed/absent value yields null. Único lugar
 * de esta normalización (lo consumen el resolver y los read-models).
 */
export const coerceCommissionConfig = (
  type: CommissionType,
  raw: unknown,
): CommissionConfig => {
  if (raw == null || type === "percentage") return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (type === "tiered") {
    const tiers = obj.tiers;
    if (!Array.isArray(tiers)) return null;
    const clean = tiers.flatMap((t) => {
      if (!t || typeof t !== "object") return [];
      const r = t as Record<string, unknown>;
      const salesCount = Number(r.salesCount);
      const payoutCents = Number(r.payoutCents);
      if (!Number.isFinite(salesCount) || !Number.isFinite(payoutCents)) return [];
      return [{ salesCount: Math.trunc(salesCount), payoutCents: Math.trunc(payoutCents) }];
    });
    return { tiers: clean };
  }
  const rewards = obj.rewards;
  if (!Array.isArray(rewards)) return null;
  const clean = rewards.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const row = r as Record<string, unknown>;
    const salesCount = Number(row.salesCount);
    const label = typeof row.label === "string" ? row.label : "";
    const icon = typeof row.icon === "string" ? row.icon : "";
    if (!Number.isFinite(salesCount) || !label || !icon) return [];
    return [{ salesCount: Math.trunc(salesCount), label, icon }];
  });
  return { rewards: clean };
};

/**
 * Esquema de comisión efectivo de un promotor en un evento, por herencia de
 * 3 niveles: **promotor en el evento (override) → esquema del evento → marca**.
 * Cualquier nivel con valores null simplemente se salta — así el organizador
 * configura en un solo lugar y personaliza solo el caso raro.
 */
export const resolveCommissionScheme = (input: {
  linkType?: CommissionType | null;
  linkPct: number | null;
  linkConfigOverride: unknown;
  eventType: CommissionType | null;
  eventConfig: unknown;
  eventPct: number | null;
  orgType: CommissionType | null;
  orgConfig: unknown;
  orgPct: number | null;
}): { type: CommissionType; config: CommissionConfig; pct: number } => {
  const type = input.linkType ?? input.eventType ?? input.orgType ?? "percentage";
  const pct = input.linkPct ?? input.eventPct ?? input.orgPct ?? 0;
  const config =
    coerceCommissionConfig(type, input.linkConfigOverride) ??
    coerceCommissionConfig(type, input.eventConfig) ??
    coerceCommissionConfig(type, input.orgConfig);
  return { type, config, pct };
};

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

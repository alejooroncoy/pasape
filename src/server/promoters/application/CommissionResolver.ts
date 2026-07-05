import type {
  CommissionConfig,
  CommissionMilestone,
  MilestoneBasis,
  MilestoneRewardKind,
} from "../domain/OrgPromoter";

const REWARD_KINDS: MilestoneRewardKind[] = ["cash", "perk"];

/** Normaliza un hito crudo (shape nuevo). Descarta lo irrecuperable. */
const coerceMilestone = (raw: unknown): CommissionMilestone[] => {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  // `salesCount` es el nombre viejo del umbral (pre-v3).
  const threshold = Number(r.threshold ?? r.salesCount);
  if (!Number.isFinite(threshold)) return [];
  // `bottle`/`custom` (pre-v3) colapsan a `perk`.
  const rawKind = r.rewardKind;
  const rewardKind: MilestoneRewardKind = rawKind === "cash" ? "cash" : "perk";
  const label = typeof r.label === "string" ? r.label : "";
  if (rewardKind === "cash") {
    const amountCents = Number(r.amountCents);
    if (!Number.isFinite(amountCents)) return [];
    return [{ threshold: Math.trunc(threshold), rewardKind, amountCents: Math.trunc(amountCents), label }];
  }
  return [{ threshold: Math.trunc(threshold), rewardKind, amountCents: null, label }];
};

/** Migra un hito del shape VIEJO `{ tiers }` (cash) → milestone. */
const coerceLegacyTier = (raw: unknown): CommissionMilestone[] => {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const threshold = Number(r.salesCount);
  const payoutCents = Number(r.payoutCents);
  if (!Number.isFinite(threshold) || !Number.isFinite(payoutCents)) return [];
  return [{ threshold: Math.trunc(threshold), rewardKind: "cash", amountCents: Math.trunc(payoutCents), label: "" }];
};

/** Migra un hito del shape VIEJO `{ rewards }` (especie) → milestone perk. */
const coerceLegacyReward = (raw: unknown): CommissionMilestone[] => {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const threshold = Number(r.salesCount);
  const label = typeof r.label === "string" ? r.label : "";
  if (!Number.isFinite(threshold) || !label) return [];
  return [{ threshold: Math.trunc(threshold), rewardKind: "perk", amountCents: null, label }];
};

const coerceBasis = (raw: unknown): MilestoneBasis => (raw === "attended" ? "attended" : "sold");

/**
 * Coerce a raw jsonb `commission_config` into the typed shape. Único lugar de
 * esta normalización (lo consumen el resolver y los read-models). Lee el shape
 * v3 (`{ basis, milestones }`) y migra los viejos al vuelo:
 *  - v2: `{ milestones: [{ salesCount, rewardKind: cash|bottle|custom, ... }] }`
 *  - v1: `{ tiers }` (cash) / `{ rewards }` (especie)
 */
export const coerceCommissionConfig = (raw: unknown): CommissionConfig => {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.milestones)) {
    return { basis: coerceBasis(obj.basis), milestones: obj.milestones.flatMap(coerceMilestone) };
  }
  if (Array.isArray(obj.tiers)) {
    return { basis: "sold", milestones: obj.tiers.flatMap(coerceLegacyTier) };
  }
  if (Array.isArray(obj.rewards)) {
    return { basis: "sold", milestones: obj.rewards.flatMap(coerceLegacyReward) };
  }
  return null;
};

/**
 * Esquema de comisión efectivo de un promotor en un evento, por herencia de
 * 4 niveles, del MÁS específico al más general:
 *
 *   1. promotor en el evento (link override) — el caso especial.
 *   2. promotor general (su tarifa negociada, vale para todos sus eventos).
 *   3. evento (default de ESTE evento, para los que no tienen tarifa propia).
 *   4. marca (regla base de la organización, para todos los promotores/eventos).
 *
 * Precedencia clave: la **tarifa del promotor gana sobre el default del evento**
 * ("te dije que ganas 20% siempre, aunque el evento en general sea 15%"); si en
 * un evento puntual gana otra cosa, se fija en su fila (nivel 1).
 *
 * Dos ejes INDEPENDIENTES: `pct` (por venta) y `config` (metas). Cada nivel con
 * valor null se salta — se configura en un solo lugar y se personaliza el raro.
 */
export const resolveCommissionScheme = (input: {
  linkPct: number | null;
  linkConfigOverride: unknown;
  /** Tarifa/metas propias del promotor (org_promoter): valen para todos sus eventos. */
  promoterPct: number | null;
  promoterConfig: unknown;
  eventPct: number | null;
  eventConfig: unknown;
  /** Default de la marca (organization): base para todos. */
  brandPct: number | null;
  brandConfig: unknown;
}): { config: CommissionConfig; pct: number } => {
  const pct =
    input.linkPct ?? input.promoterPct ?? input.eventPct ?? input.brandPct ?? 0;
  const config =
    coerceCommissionConfig(input.linkConfigOverride) ??
    coerceCommissionConfig(input.promoterConfig) ??
    coerceCommissionConfig(input.eventConfig) ??
    coerceCommissionConfig(input.brandConfig);
  return { config, pct };
};

export type PayoutInput = {
  pct: number;
  config: CommissionConfig;
  /** Entradas vendidas de pago (base `sold`). */
  soldUnits: number;
  /** Gente que entró/validó, gratis + pago (base `attended`). */
  attendedUnits: number;
  grossCents: number;
};

export type UnlockedReward = { label: string };

export type PayoutResult = {
  /** Dinero a pagar: % del gross vendido + suma de hitos cash conseguidos. */
  payoutCents: number;
  /** Premios en especie cuyo umbral ya se alcanzó. */
  rewards: UnlockedReward[];
};

/**
 * Payout del promotor sobre los DOS ejes, sumados:
 *   - comisión %: round(gross * pct / 100)   [siempre sobre venta de pago]
 *   - metas: hitos cash + premios en especie cuyo umbral se alcanzó, contando
 *     por `config.basis` (ventas o asistencia).
 * El desbloqueo se deriva del conteo (no se persiste) → un reembolso/no-show baja
 * el conteo y el payout retrocede solo.
 *
 * Safe con cualquier input: configs malformadas rinden 0 / [].
 */
export const computePromoterPayout = ({
  pct,
  config,
  soldUnits,
  attendedUnits,
  grossCents,
}: PayoutInput): PayoutResult => {
  let payoutCents = Math.round((grossCents * pct) / 100);
  const rewards: UnlockedReward[] = [];
  if (config) {
    const count = config.basis === "attended" ? attendedUnits : soldUnits;
    for (const m of config.milestones) {
      if (count < m.threshold) continue;
      if (m.rewardKind === "cash") payoutCents += m.amountCents ?? 0;
      else rewards.push({ label: m.label });
    }
  }
  return { payoutCents, rewards };
};

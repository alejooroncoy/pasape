import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { OrgPromoterRepository } from "../../ports/OrgPromoterRepository";
import type {
  CommissionConfig,
  CommissionType,
  OrgPromoter,
} from "../../domain/OrgPromoter";

type Row = {
  id: string;
  organization_id: string;
  name: string;
  whatsapp: string | null;
  default_commission_pct: number;
  commission_type: CommissionType;
  commission_config: unknown;
  profile_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Coerce a raw jsonb value to a typed CommissionConfig.
 * Validates only the shape we expect for the given commission type; anything
 * malformed becomes `null` so downstream code can fall back to defaults.
 */
const parseCommissionConfig = (
  type: CommissionType,
  raw: unknown,
): CommissionConfig => {
  if (raw == null) return null;
  if (type === "percentage") return null;
  if (!isObject(raw)) return null;
  if (type === "tiered") {
    const tiers = raw.tiers;
    if (!Array.isArray(tiers)) return null;
    const clean = tiers.flatMap((t) => {
      if (!isObject(t)) return [];
      const salesCount = Number(t.salesCount);
      const payoutCents = Number(t.payoutCents);
      if (!Number.isFinite(salesCount) || !Number.isFinite(payoutCents)) return [];
      return [{ salesCount: Math.trunc(salesCount), payoutCents: Math.trunc(payoutCents) }];
    });
    return { tiers: clean };
  }
  // inkind
  const rewards = raw.rewards;
  if (!Array.isArray(rewards)) return null;
  const clean = rewards.flatMap((r) => {
    if (!isObject(r)) return [];
    const salesCount = Number(r.salesCount);
    const label = typeof r.label === "string" ? r.label : "";
    const icon = typeof r.icon === "string" ? r.icon : "";
    if (!Number.isFinite(salesCount) || !label || !icon) return [];
    return [{ salesCount: Math.trunc(salesCount), label, icon }];
  });
  return { rewards: clean };
};

/**
 * Validate user-supplied jsonb before persisting. Returns the canonical
 * value to store, or an error describing why it was rejected.
 */
const validateCommissionConfigForWrite = (
  type: CommissionType,
  raw: CommissionConfig | undefined,
): Result<CommissionConfig> => {
  if (type === "percentage") return ok(null);
  if (raw == null) return err("commission_config_required");
  if (type === "tiered") {
    if (!("tiers" in raw) || !Array.isArray(raw.tiers) || raw.tiers.length === 0)
      return err("tiers_required");
    for (const t of raw.tiers) {
      if (!Number.isInteger(t.salesCount) || t.salesCount < 1) return err("tier_sales_invalid");
      if (!Number.isInteger(t.payoutCents) || t.payoutCents < 0) return err("tier_payout_invalid");
    }
    const sorted = [...raw.tiers].sort((a, b) => a.salesCount - b.salesCount);
    return ok({ tiers: sorted });
  }
  // inkind
  if (!("rewards" in raw) || !Array.isArray(raw.rewards) || raw.rewards.length === 0)
    return err("rewards_required");
  for (const r of raw.rewards) {
    if (!Number.isInteger(r.salesCount) || r.salesCount < 1) return err("reward_sales_invalid");
    if (!r.label || !r.icon) return err("reward_fields_invalid");
  }
  const sorted = [...raw.rewards].sort((a, b) => a.salesCount - b.salesCount);
  return ok({ rewards: sorted });
};

const toDomain = (r: Row): OrgPromoter => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  whatsapp: r.whatsapp,
  defaultCommissionPct: r.default_commission_pct,
  commissionType: r.commission_type,
  commissionConfig: parseCommissionConfig(r.commission_type, r.commission_config),
  profileId: r.profile_id,
  notes: r.notes,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

export const supabaseOrgPromoterRepository: OrgPromoterRepository = {
  async listByOrg(organizationId) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("org_promoters")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return (data as Row[] | null)?.map(toDomain) ?? [];
  },

  async findById(id) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("org_promoters")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle<Row>();
    return data ? toDomain(data) : null;
  },

  async create(input): Promise<Result<OrgPromoter>> {
    const cfg = validateCommissionConfigForWrite(input.commissionType, input.commissionConfig);
    if (!cfg.ok) return err(cfg.error);
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("org_promoters")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        whatsapp: input.whatsapp,
        default_commission_pct: input.defaultCommissionPct,
        commission_type: input.commissionType,
        commission_config: cfg.value,
        notes: input.notes ?? null,
        created_by: input.createdBy,
      })
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "org_promoter_create_failed");
    return ok(toDomain(data));
  },

  async update(id, organizationId, input): Promise<Result<OrgPromoter>> {
    const db = supabaseAdmin();
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.whatsapp !== undefined) patch.whatsapp = input.whatsapp;
    if (input.defaultCommissionPct !== undefined)
      patch.default_commission_pct = input.defaultCommissionPct;
    if (input.notes !== undefined) patch.notes = input.notes;

    // commission_type and commission_config must be validated together: a new
    // type implies a new config shape. If only one is provided, look up the
    // current row to fill in the other side before validating.
    if (input.commissionType !== undefined || input.commissionConfig !== undefined) {
      let type = input.commissionType;
      let config = input.commissionConfig;
      if (type === undefined || config === undefined) {
        const { data: current } = await db
          .from("org_promoters")
          .select("commission_type, commission_config")
          .eq("id", id)
          .eq("organization_id", organizationId)
          .maybeSingle<{ commission_type: CommissionType; commission_config: unknown }>();
        if (!current) return err("not_found");
        if (type === undefined) type = current.commission_type;
        if (config === undefined) config = parseCommissionConfig(type, current.commission_config);
      }
      const cfg = validateCommissionConfigForWrite(type, config);
      if (!cfg.ok) return err(cfg.error);
      patch.commission_type = type;
      patch.commission_config = cfg.value;
    }

    if (Object.keys(patch).length === 0) return err("nothing_to_update");
    const { data, error } = await db
      .from("org_promoters")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "org_promoter_update_failed");
    return ok(toDomain(data));
  },

  async softDelete(id, organizationId): Promise<Result<true>> {
    const db = supabaseAdmin();
    const { error } = await db
      .from("org_promoters")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) return err(error.message);
    return ok(true);
  },
};

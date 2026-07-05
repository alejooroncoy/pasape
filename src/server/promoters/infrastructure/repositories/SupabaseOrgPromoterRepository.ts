import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { OrgPromoterRepository } from "../../ports/OrgPromoterRepository";
import type { CommissionConfig, OrgPromoter } from "../../domain/OrgPromoter";
import { coerceCommissionConfig } from "../../application/CommissionResolver";

type Row = {
  id: string;
  organization_id: string;
  name: string;
  whatsapp: string | null;
  default_commission_pct: number | null;
  commission_config: unknown;
  profile_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

/**
 * Validate user-supplied jsonb (metas) before persisting. Las metas son un eje
 * independiente del %: null = sin metas (válido); si hay, exige al menos un hito
 * bien formado (cash con monto; perk con label). Devuelve el config canónico.
 */
const validateCommissionConfigForWrite = (
  raw: CommissionConfig | undefined,
): Result<CommissionConfig> => {
  if (raw == null) return ok(null);
  if (!("milestones" in raw) || raw.milestones.length === 0)
    return err("commission_config_required");
  for (const m of raw.milestones) {
    if (!Number.isInteger(m.threshold) || m.threshold < 1) return err("milestone_threshold_invalid");
    if (m.rewardKind === "cash") {
      if (!Number.isInteger(m.amountCents) || (m.amountCents ?? -1) < 0)
        return err("milestone_amount_invalid");
    } else if (!m.label) {
      return err("milestone_label_required");
    }
  }
  const sorted = [...raw.milestones].sort((a, b) => a.threshold - b.threshold);
  return ok({ basis: raw.basis, milestones: sorted });
};

const toDomain = (r: Row): OrgPromoter => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  whatsapp: r.whatsapp,
  defaultCommissionPct: r.default_commission_pct,
  commissionConfig: coerceCommissionConfig(r.commission_config),
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
    const cfg = validateCommissionConfigForWrite(input.commissionConfig);
    if (!cfg.ok) return err(cfg.error);
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("org_promoters")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        whatsapp: input.whatsapp,
        default_commission_pct: input.defaultCommissionPct,
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

    // Metas (config) es un eje independiente: si viene, se valida su forma.
    if (input.commissionConfig !== undefined) {
      const cfg = validateCommissionConfigForWrite(input.commissionConfig);
      if (!cfg.ok) return err(cfg.error);
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

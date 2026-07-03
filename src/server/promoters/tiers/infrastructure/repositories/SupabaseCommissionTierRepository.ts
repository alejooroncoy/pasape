import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type {
  CommissionRewardKind,
  CommissionTier,
} from "@/server/promoters/tiers/domain/CommissionTier";
import type {
  CommissionTierRepository,
  CreateCommissionTierInput,
  LinkOwnership,
  UpdateCommissionTierInput,
} from "@/server/promoters/tiers/ports/CommissionTierRepository";

type Row = {
  id: string;
  promoter_link_id: string;
  threshold_count: number;
  reward_kind: CommissionRewardKind;
  reward_amount_cents: number | null;
  reward_label: string;
  unlocked_at: string | null;
  created_at: string;
};

const toDomain = (r: Row): CommissionTier => ({
  id: r.id,
  promoterLinkId: r.promoter_link_id,
  thresholdCount: r.threshold_count,
  rewardKind: r.reward_kind,
  rewardAmountCents: r.reward_amount_cents,
  rewardLabel: r.reward_label,
  unlockedAt: r.unlocked_at,
  createdAt: r.created_at,
});

export const supabaseCommissionTierRepository: CommissionTierRepository = {
  async listForLink(linkId) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("commission_tiers")
      .select("*")
      .eq("promoter_link_id", linkId)
      .order("threshold_count", { ascending: true });
    return ((data as Row[] | null) ?? []).map(toDomain);
  },

  async create(input: CreateCommissionTierInput): Promise<Result<CommissionTier>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("commission_tiers")
      .insert({
        promoter_link_id: input.promoterLinkId,
        threshold_count: input.thresholdCount,
        reward_kind: input.rewardKind,
        reward_amount_cents: input.rewardAmountCents,
        reward_label: input.rewardLabel,
      })
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "tier_create_failed");
    return ok(toDomain(data));
  },

  async update(input: UpdateCommissionTierInput): Promise<Result<CommissionTier>> {
    const db = supabaseAdmin();
    const patch: Record<string, unknown> = {};
    if (input.thresholdCount !== undefined) patch.threshold_count = input.thresholdCount;
    if (input.rewardKind !== undefined) patch.reward_kind = input.rewardKind;
    if (input.rewardAmountCents !== undefined)
      patch.reward_amount_cents = input.rewardAmountCents;
    if (input.rewardLabel !== undefined) patch.reward_label = input.rewardLabel;
    const { data, error } = await db
      .from("commission_tiers")
      .update(patch)
      .eq("id", input.id)
      // Scoping anti-IDOR: el tier debe pertenecer al link ya autorizado.
      .eq("promoter_link_id", input.promoterLinkId)
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "tier_update_failed");
    return ok(toDomain(data));
  },

  async remove(id: string, promoterLinkId: string): Promise<Result<{ id: string }>> {
    const db = supabaseAdmin();
    const { error } = await db
      .from("commission_tiers")
      .delete()
      .eq("id", id)
      .eq("promoter_link_id", promoterLinkId);
    if (error) return err(error.message);
    return ok({ id });
  },

  async recalcUnlocksForLink(linkId: string, soldCount: number) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("commission_tiers")
      .select("id, threshold_count, unlocked_at")
      .eq("promoter_link_id", linkId)
      .is("unlocked_at", null)
      .lte("threshold_count", soldCount);
    const rows = (data as Array<{ id: string; threshold_count: number; unlocked_at: string | null }> | null) ?? [];
    if (rows.length === 0) return { unlockedIds: [] };
    const now = new Date().toISOString();
    const ids = rows.map((r) => r.id);
    await db
      .from("commission_tiers")
      .update({ unlocked_at: now })
      .in("id", ids);
    return { unlockedIds: ids };
  },

  async ownershipOf(linkId: string): Promise<LinkOwnership | null> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("promoter_links")
      .select("id, promoter_id, event:events!inner(id, organization_id)")
      .eq("id", linkId)
      .maybeSingle();
    if (!data) return null;
    type LR = {
      id: string;
      promoter_id: string;
      event: { id: string; organization_id: string };
    };
    const r = data as unknown as LR;
    return {
      linkId: r.id,
      eventId: r.event.id,
      organizationId: r.event.organization_id,
      promoterId: r.promoter_id,
    };
  },
};

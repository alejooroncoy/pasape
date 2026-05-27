import { z } from "zod";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseCommissionTierRepository as repo } from "../../infrastructure/repositories/SupabaseCommissionTierRepository";
import {
  createTier,
  listTiersForLink,
  removeTier,
  updateTier,
} from "../../application/CommissionTierServices";
import type { CommissionTier } from "../../domain/CommissionTier";

const rewardKind = z.enum(["cash", "bottle", "custom"]);

const createSchema = z.object({
  thresholdCount: z.number().int().positive(),
  rewardKind,
  rewardAmountCents: z.number().int().nonnegative().nullable().optional(),
  rewardLabel: z.string().min(1),
});

const updateSchema = z.object({
  thresholdCount: z.number().int().positive().optional(),
  rewardKind: rewardKind.optional(),
  rewardAmountCents: z.number().int().nonnegative().nullable().optional(),
  rewardLabel: z.string().min(1).optional(),
});

type Role = "organizer" | "promoter";

async function authForLink(
  linkId: string,
): Promise<
  | { ok: true; role: Role; profileId: string }
  | { ok: false; error: string }
> {
  const auth = await getAuthContext();
  if (!auth.ok) return { ok: false, error: auth.error };
  const ownership = await repo.ownershipOf(linkId);
  if (!ownership) return { ok: false, error: "not_found" };

  const profileId = auth.value.profileId;
  if (ownership.promoterId === profileId) {
    return { ok: true, role: "promoter", profileId };
  }
  const db = supabaseAdmin();
  const { data: membership } = await db
    .from("memberships")
    .select("role")
    .eq("scope_type", "organization")
    .eq("scope_id", ownership.organizationId)
    .eq("profile_id", profileId)
    .maybeSingle<{ role: string }>();
  if (membership) return { ok: true, role: "organizer", profileId };
  return { ok: false, error: "forbidden" };
}

export const CommissionTiersController = {
  async list(linkId: string): Promise<Result<CommissionTier[]>> {
    const a = await authForLink(linkId);
    if (!a.ok) return err(a.error);
    return ok(await listTiersForLink({ repo }, linkId));
  },

  async create(linkId: string, input: unknown): Promise<Result<CommissionTier>> {
    const a = await authForLink(linkId);
    if (!a.ok) return err(a.error);
    if (a.role !== "organizer") return err("forbidden");
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return createTier(
      { repo },
      {
        promoterLinkId: linkId,
        thresholdCount: parsed.data.thresholdCount,
        rewardKind: parsed.data.rewardKind,
        rewardAmountCents: parsed.data.rewardAmountCents ?? null,
        rewardLabel: parsed.data.rewardLabel,
      },
    );
  },

  async update(
    linkId: string,
    tierId: string,
    input: unknown,
  ): Promise<Result<CommissionTier>> {
    const a = await authForLink(linkId);
    if (!a.ok) return err(a.error);
    if (a.role !== "organizer") return err("forbidden");
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return updateTier({ repo }, { id: tierId, ...parsed.data });
  },

  async remove(linkId: string, tierId: string): Promise<Result<{ id: string }>> {
    const a = await authForLink(linkId);
    if (!a.ok) return err(a.error);
    if (a.role !== "organizer") return err("forbidden");
    return removeTier({ repo }, tierId);
  },
};

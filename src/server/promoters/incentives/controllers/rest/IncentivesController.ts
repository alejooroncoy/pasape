import { z } from "zod";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseEventRepository } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { getEventBySlug } from "@/server/events/application/GetEventBySlug";
import { supabaseIncentiveRepository as repo } from "../../infrastructure/repositories/SupabaseIncentiveRepository";
import { listIncentivesForEvent } from "../../application/ListIncentivesForEvent";
import { createIncentive } from "../../application/CreateIncentive";
import type { Incentive } from "../../domain/Incentive";

const createSchema = z.object({
  audience: z.enum(["promoter", "buyer"]).default("promoter"),
  name: z.string().min(1),
  goalKind: z
    .enum(["tickets_sold", "revenue_cents", "tickets_bought", "referrals"])
    .default("tickets_sold"),
  goalValue: z.number().int().positive(),
  reward: z.string().min(1),
});

async function guard(slug: string) {
  const auth = await getAuthContext();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const detail = await getEventBySlug({ repo: supabaseEventRepository }, slug);
  if (!detail) return { ok: false as const, error: "not_found" };
  const db = supabaseAdmin();
  const { data: membership } = await db
    .from("memberships")
    .select("role")
    .eq("scope_type", "organization")
    .eq("scope_id", detail.event.organizationId)
    .eq("profile_id", auth.value.profileId)
    .maybeSingle<{ role: string }>();
  if (!membership) return { ok: false as const, error: "forbidden" };
  return { ok: true as const, value: detail };
}

async function readGuard(slug: string) {
  const auth = await getAuthContext();
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const detail = await getEventBySlug({ repo: supabaseEventRepository }, slug);
  if (!detail) return { ok: false as const, error: "not_found" };
  const db = supabaseAdmin();
  const [{ data: membership }, { data: promoterLink }] = await Promise.all([
    db
      .from("memberships")
      .select("role")
      .eq("scope_type", "organization")
      .eq("scope_id", detail.event.organizationId)
      .eq("profile_id", auth.value.profileId)
      .maybeSingle<{ role: string }>(),
    db
      .from("promoter_links")
      .select("id")
      .eq("event_id", detail.event.id)
      .eq("promoter_id", auth.value.profileId)
      .eq("active", true)
      .maybeSingle<{ id: string }>(),
  ]);
  if (!membership && !promoterLink) return { ok: false as const, error: "forbidden" };
  return { ok: true as const, value: detail, promoterLink };
}

export const IncentivesController = {
  async list(slug: string): Promise<Result<Array<Incentive & { unlockedCount: number; isUnlockedByMe: boolean }>>> {
    const g = await readGuard(slug);
    if (!g.ok) return err(g.error);
    let soldCount = 0;
    if (g.promoterLink) {
      const db = supabaseAdmin();
      const { count } = await db
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("promoter_link_id", g.promoterLink.id)
        .eq("status", "paid");
      soldCount = count ?? 0;
    }
    const incentives = await listIncentivesForEvent({ repo }, g.value.event.id);
    return ok(incentives.map((inc) => ({ ...inc, isUnlockedByMe: soldCount >= inc.goalValue })));
  },

  async create(slug: string, input: unknown): Promise<Result<Incentive>> {
    const g = await guard(slug);
    if (!g.ok) return err(g.error);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return createIncentive(
      { repo },
      {
        eventId: g.value.event.id,
        audience: parsed.data.audience,
        name: parsed.data.name,
        goalKind: parsed.data.goalKind,
        goalValue: parsed.data.goalValue,
        reward: parsed.data.reward,
      },
    );
  },
};

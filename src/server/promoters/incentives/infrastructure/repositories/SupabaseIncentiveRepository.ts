import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type {
  CreateIncentiveInput,
  IncentiveRepository,
} from "@/server/promoters/incentives/ports/IncentiveRepository";
import type {
  Incentive,
  IncentiveAudience,
  IncentiveGoalKind,
} from "@/server/promoters/incentives/domain/Incentive";

type Row = {
  id: string;
  event_id: string;
  audience: IncentiveAudience;
  name: string;
  goal_kind: IncentiveGoalKind;
  goal_value: number;
  reward: string;
  active: boolean;
  created_at: string;
};

const toDomain = (r: Row): Incentive => ({
  id: r.id,
  eventId: r.event_id,
  audience: r.audience,
  name: r.name,
  goalKind: r.goal_kind,
  goalValue: r.goal_value,
  reward: r.reward,
  active: r.active,
  createdAt: r.created_at,
});

export const supabaseIncentiveRepository: IncentiveRepository = {
  async listForEvent(eventId) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("incentives")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    const rows = (data as Row[] | null) ?? [];
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const { data: unlocks } = await db
      .from("incentive_unlocks")
      .select("incentive_id")
      .in("incentive_id", ids);
    const counts = new Map<string, number>();
    for (const u of (unlocks as Array<{ incentive_id: string }> | null) ?? []) {
      counts.set(u.incentive_id, (counts.get(u.incentive_id) ?? 0) + 1);
    }
    return rows.map((r) => ({ ...toDomain(r), unlockedCount: counts.get(r.id) ?? 0 }));
  },

  async create(input: CreateIncentiveInput): Promise<Result<Incentive>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("incentives")
      .insert({
        event_id: input.eventId,
        audience: input.audience,
        name: input.name,
        goal_kind: input.goalKind,
        goal_value: input.goalValue,
        reward: input.reward,
      })
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "incentive_create_failed");
    return ok(toDomain(data));
  },
};

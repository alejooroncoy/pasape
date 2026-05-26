import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { OnboardingState } from "../../domain/OnboardingState";

type Row = {
  profile_id: string;
  completed_tours: string[] | null;
  updated_at: string;
};

const toDomain = (r: Row): OnboardingState => ({
  profileId: r.profile_id,
  completedTours: r.completed_tours ?? [],
  updatedAt: r.updated_at,
});

export const supabaseOnboardingRepository = {
  async get(profileId: string): Promise<OnboardingState> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("profile_onboarding_state")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle<Row>();
    if (!data) {
      return {
        profileId,
        completedTours: [],
        updatedAt: new Date(0).toISOString(),
      };
    }
    return toDomain(data);
  },

  async completeTour(profileId: string, tourId: string): Promise<Result<OnboardingState>> {
    const db = supabaseAdmin();
    const current = await this.get(profileId);
    if (current.completedTours.includes(tourId)) {
      return ok(current);
    }
    const next = [...current.completedTours, tourId];
    const { data, error } = await db
      .from("profile_onboarding_state")
      .upsert(
        {
          profile_id: profileId,
          completed_tours: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      )
      .select("*")
      .single<Row>();
    if (error || !data) return err(error?.message ?? "onboarding_upsert_failed");
    return ok(toDomain(data));
  },
};

import { z } from "zod";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseOnboardingRepository } from "../../infrastructure/repositories/SupabaseOnboardingRepository";

const repo = supabaseOnboardingRepository;

const completeSchema = z.object({ tourId: z.string().min(1).max(64) });

export const OnboardingController = {
  async getState(): Promise<Result<{ completedTours: string[] }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const state = await repo.get(auth.value.profileId);
    return ok({ completedTours: state.completedTours });
  },

  async complete(input: unknown): Promise<Result<{ completedTours: string[] }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = completeSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    const result = await repo.completeTour(auth.value.profileId, parsed.data.tourId);
    if (!result.ok) return result;
    return ok({ completedTours: result.value.completedTours });
  },
};

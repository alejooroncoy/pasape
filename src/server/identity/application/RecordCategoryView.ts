import "server-only";
import { ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

// Señal cruda para un futuro motor de recomendaciones (ver profile_category_views).
// Best-effort: si el RPC falla, no debe romper la vista del evento por esto.
export const recordCategoryView = async (
  profileId: string,
  category: string,
): Promise<Result<{ ok: true }>> => {
  const db = supabaseAdmin();
  const { error } = await db.rpc("increment_category_view", {
    p_profile_id: profileId,
    p_category: category,
  });
  if (error) console.error("[recordCategoryView] failed:", error.message);
  return ok({ ok: true });
};

import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";

/** Sigue una organización (idempotente: si ya seguía, no falla). */
export const followOrg = async (
  profileId: string,
  organizationId: string,
): Promise<Result<{ following: true }>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("follows")
    .upsert(
      { follower_id: profileId, organization_id: organizationId },
      { onConflict: "follower_id,organization_id", ignoreDuplicates: true },
    );
  if (error) return err(error.message);
  return ok({ following: true });
};

/** Deja de seguir (idempotente). */
export const unfollowOrg = async (
  profileId: string,
  organizationId: string,
): Promise<Result<{ following: false }>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("follows")
    .delete()
    .eq("follower_id", profileId)
    .eq("organization_id", organizationId);
  if (error) return err(error.message);
  return ok({ following: false });
};

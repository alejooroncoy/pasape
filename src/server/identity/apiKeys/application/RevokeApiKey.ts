import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

export const revokeApiKey = async (
  apiKeyId: string,
  organizationId: string,
): Promise<Result<{ id: string }>> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("organizer_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", apiKeyId)
    .eq("organization_id", organizationId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return err(error.message);
  if (!data) return err("not_found");
  return ok({ id: data.id as string });
};

import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { ApiKey } from "../domain/ApiKey";

export const listApiKeys = async (organizationId: string): Promise<Result<ApiKey[]>> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("organizer_api_keys")
    .select("id, organization_id, created_by, name, key_prefix, last_used_at, revoked_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) return err(error.message);
  return ok(
    (data ?? []).map((row) => ({
      id: row.id as string,
      organizationId: row.organization_id as string,
      createdBy: row.created_by as string,
      name: row.name as string,
      keyPrefix: row.key_prefix as string,
      lastUsedAt: row.last_used_at as string | null,
      revokedAt: row.revoked_at as string | null,
      createdAt: row.created_at as string,
    })),
  );
};

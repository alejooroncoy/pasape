import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { hashToken } from "../infrastructure/tokens";
import type { OAuthIdentity } from "../domain/OAuthClient";

export const verifyAccessToken = async (accessToken: string): Promise<Result<OAuthIdentity>> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("oauth_tokens")
    .select("organization_id, profile_id, access_expires_at, revoked_at")
    .eq("access_token_hash", hashToken(accessToken))
    .maybeSingle();

  if (error) return err(error.message);
  if (!data || data.revoked_at) return err("invalid_or_revoked_token");
  if (new Date(data.access_expires_at as string) < new Date()) return err("token_expired");

  return ok({
    organizationId: data.organization_id as string,
    createdBy: data.profile_id as string,
  });
};

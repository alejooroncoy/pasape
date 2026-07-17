import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { hashApiKey, looksLikeApiKey } from "../infrastructure/hash";
import type { ApiKeyIdentity } from "../domain/ApiKey";

/** Resuelve una key en claro (recibida en el header Authorization del MCP) a
 *  la identidad del organizador dueño. No revalida contra Supabase Auth —
 *  la key ES la credencial, igual que un token de sesión. */
export const verifyApiKey = async (plaintext: string): Promise<Result<ApiKeyIdentity>> => {
  if (!looksLikeApiKey(plaintext)) return err("invalid_key_format");

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("organizer_api_keys")
    .select("id, organization_id, created_by, revoked_at")
    .eq("key_hash", hashApiKey(plaintext))
    .maybeSingle();

  if (error) return err(error.message);
  if (!data || data.revoked_at) return err("invalid_or_revoked_key");

  // Best-effort: no bloquea la respuesta si falla.
  void db
    .from("organizer_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return ok({
    apiKeyId: data.id as string,
    organizationId: data.organization_id as string,
    createdBy: data.created_by as string,
  });
};

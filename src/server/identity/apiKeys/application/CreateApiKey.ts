import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { generateApiKey } from "../infrastructure/hash";

type Input = { organizationId: string; createdBy: string; name: string };

/** Devuelve el plaintext SOLO en esta respuesta — no se vuelve a poder leer. */
export const createApiKey = async (
  input: Input,
): Promise<Result<{ id: string; plaintext: string; keyPrefix: string }>> => {
  if (!input.name.trim()) return err("name_required");

  const { plaintext, hash, prefix } = generateApiKey();
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("organizer_api_keys")
    .insert({
      organization_id: input.organizationId,
      created_by: input.createdBy,
      name: input.name.trim(),
      key_hash: hash,
      key_prefix: prefix,
    })
    .select("id")
    .single();

  if (error) return err(error.message);
  return ok({ id: data.id as string, plaintext, keyPrefix: prefix });
};

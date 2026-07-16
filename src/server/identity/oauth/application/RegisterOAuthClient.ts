import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

// Dynamic Client Registration (RFC 7591): Claude.ai / Claude Desktop / Cursor
// se auto-registran la primera vez que el usuario pega la URL del MCP — no
// hay un formulario donde el fundador "crea una app" a mano.
type Input = { clientName: string; redirectUris: string[] };

export const registerOAuthClient = async (
  input: Input,
): Promise<Result<{ clientId: string }>> => {
  if (input.redirectUris.length === 0) return err("redirect_uris_required");
  for (const uri of input.redirectUris) {
    try {
      new URL(uri);
    } catch {
      return err("invalid_redirect_uri");
    }
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("oauth_clients")
    .insert({
      client_name: input.clientName.trim() || "MCP client",
      redirect_uris: input.redirectUris,
    })
    .select("id")
    .single();

  if (error) return err(error.message);
  return ok({ clientId: data.id as string });
};

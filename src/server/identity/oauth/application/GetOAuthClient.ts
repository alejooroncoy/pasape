import "server-only";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { OAuthClient } from "../domain/OAuthClient";

export const getOAuthClient = async (clientId: string): Promise<OAuthClient | null> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("oauth_clients")
    .select("id, client_name, redirect_uris")
    .eq("id", clientId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    clientName: data.client_name as string,
    redirectUris: data.redirect_uris as string[],
  };
};

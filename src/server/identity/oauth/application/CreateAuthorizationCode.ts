import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { randomToken } from "../infrastructure/tokens";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 min — solo vive el redirect ida y vuelta.

type Input = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  organizationId: string;
  profileId: string;
};

/** Emitido después de que el organizador aprobó el consentimiento — solo
 *  falta que el cliente lo canjee en /token con el code_verifier (PKCE). */
export const createAuthorizationCode = async (
  input: Input,
): Promise<Result<{ code: string }>> => {
  const code = randomToken(32);
  const db = supabaseAdmin();
  const { error } = await db.from("oauth_authorization_codes").insert({
    code,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    organization_id: input.organizationId,
    profile_id: input.profileId,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) return err(error.message);
  return ok({ code });
};

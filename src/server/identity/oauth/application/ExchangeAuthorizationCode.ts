import "server-only";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { hashToken, randomToken, verifyPkce } from "../infrastructure/tokens";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h — el cliente refresca con refresh_token.

type TokenPair = { accessToken: string; refreshToken: string; expiresInSeconds: number };

type ExchangeInput = {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
};

/** authorization_code grant: valida PKCE + que el code no esté vencido/usado
 *  (single-use — un segundo canje del mismo code es una señal de replay). */
export const exchangeAuthorizationCode = async (
  input: ExchangeInput,
): Promise<Result<TokenPair>> => {
  const db = supabaseAdmin();
  const { data: codeRow, error } = await db
    .from("oauth_authorization_codes")
    .select("client_id, redirect_uri, code_challenge, organization_id, profile_id, expires_at, used_at")
    .eq("code", input.code)
    .maybeSingle();

  if (error) return err(error.message);
  if (!codeRow) return err("invalid_grant");
  if (codeRow.used_at) return err("code_already_used");
  if (new Date(codeRow.expires_at as string) < new Date()) return err("code_expired");
  if (codeRow.client_id !== input.clientId) return err("client_mismatch");
  if (codeRow.redirect_uri !== input.redirectUri) return err("redirect_uri_mismatch");
  if (!verifyPkce(input.codeVerifier, codeRow.code_challenge as string)) {
    return err("invalid_code_verifier");
  }

  // Marcar usado ANTES de emitir tokens — si esto falla, mejor negar el
  // canje que arriesgar emitir dos pares de tokens para el mismo code.
  const { error: markErr } = await db
    .from("oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code", input.code)
    .is("used_at", null);
  if (markErr) return err(markErr.message);

  return issueTokens(db, {
    clientId: codeRow.client_id as string,
    organizationId: codeRow.organization_id as string,
    profileId: codeRow.profile_id as string,
  });
};

type RefreshInput = { refreshToken: string; clientId: string };

export const refreshAccessToken = async (input: RefreshInput): Promise<Result<TokenPair>> => {
  const db = supabaseAdmin();
  const { data: row, error } = await db
    .from("oauth_tokens")
    .select("id, client_id, organization_id, profile_id, revoked_at")
    .eq("refresh_token_hash", hashToken(input.refreshToken))
    .maybeSingle();

  if (error) return err(error.message);
  if (!row || row.revoked_at || row.client_id !== input.clientId) return err("invalid_grant");

  // Rota: el refresh token viejo queda inservible al emitir el nuevo par —
  // limita el daño si un refresh token se filtra (uso único).
  await db.from("oauth_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", row.id);

  return issueTokens(db, {
    clientId: row.client_id as string,
    organizationId: row.organization_id as string,
    profileId: row.profile_id as string,
  });
};

const issueTokens = async (
  db: ReturnType<typeof supabaseAdmin>,
  ids: { clientId: string; organizationId: string; profileId: string },
): Promise<Result<TokenPair>> => {
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);

  const { error } = await db.from("oauth_tokens").insert({
    client_id: ids.clientId,
    organization_id: ids.organizationId,
    profile_id: ids.profileId,
    access_token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    access_expires_at: accessExpiresAt.toISOString(),
  });
  if (error) return err(error.message);

  return ok({
    accessToken,
    refreshToken,
    expiresInSeconds: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
  });
};

import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type {
  ClaimTokenInfo,
  PromoterClaimRepository,
} from "../ports/PromoterClaimRepository";
import type { PromoterClaimContext } from "../domain/PromoterClaim";

type PromoterRow = {
  id: string;
  organization_id: string;
  name: string;
  whatsapp: string | null;
  default_commission_pct: number | null;
  profile_id: string | null;
  claim_token: string | null;
  claim_token_expires_at: string | null;
  claim_token_used_at: string | null;
};

// Sanity check contra tokens truncados/vacíos antes de golpear la DB (el token
// real lo genera `refresh_org_promoter_claim_token` con más entropía que esto).
const MIN_CLAIM_TOKEN_LENGTH = 16;

const cleanPhone = (raw: string | null): string => {
  if (!raw) return "";
  let p = raw.trim();
  if (p.startsWith("whatsapp:")) p = p.slice("whatsapp:".length);
  if (p.startsWith("+")) p = p.slice(1);
  return p.replace(/\D/g, "");
};

const isExpired = (iso: string | null): boolean => {
  if (!iso) return true;
  return new Date(iso).getTime() <= Date.now();
};

const isStillUsable = (row: PromoterRow): boolean =>
  !!row.claim_token &&
  !row.claim_token_used_at &&
  !isExpired(row.claim_token_expires_at);

const getPrimaryEvent = async (
  orgPromoterId: string,
): Promise<{ slug: string | null; title: string | null }> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("promoter_links")
    .select("events:event_id(slug, title, starts_at)")
    .eq("org_promoter_id", orgPromoterId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ events: { slug: string; title: string; starts_at: string } | null }>();
  if (!data?.events) return { slug: null, title: null };
  return { slug: data.events.slug, title: data.events.title };
};

const buildContext = async (
  row: PromoterRow,
  alreadyClaimed: boolean,
): Promise<PromoterClaimContext> => {
  const db = supabaseAdmin();
  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("id", row.organization_id)
    .maybeSingle<{ name: string }>();
  const event = await getPrimaryEvent(row.id);
  return {
    orgPromoterId: row.id,
    organizationId: row.organization_id,
    organizationName: org?.name ?? "Pasape",
    promoterName: row.name,
    whatsapp: cleanPhone(row.whatsapp),
    defaultCommissionPct: row.default_commission_pct,
    primaryEventSlug: event.slug,
    primaryEventTitle: event.title,
    alreadyClaimed,
  };
};

export const supabasePromoterClaimRepository: PromoterClaimRepository = {
  async getOrRefreshToken(
    orgPromoterId,
    organizationId,
  ): Promise<Result<ClaimTokenInfo>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("org_promoters")
      .select("claim_token, claim_token_expires_at, claim_token_used_at, profile_id, organization_id")
      .eq("id", orgPromoterId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle<{
        claim_token: string | null;
        claim_token_expires_at: string | null;
        claim_token_used_at: string | null;
        profile_id: string | null;
        organization_id: string;
      }>();
    if (error || !data) return err("not_found");
    if (data.profile_id) return err("already_claimed");

    const stillValid =
      !!data.claim_token &&
      !data.claim_token_used_at &&
      !isExpired(data.claim_token_expires_at);

    if (stillValid && data.claim_token && data.claim_token_expires_at) {
      // Igual marcamos cuándo se reenvió el invite para que el organizador lo vea.
      await db
        .from("org_promoters")
        .update({ claim_invite_sent_at: new Date().toISOString() })
        .eq("id", orgPromoterId);
      return ok({
        token: data.claim_token,
        expiresAt: data.claim_token_expires_at,
      });
    }

    // Refresca via función PG (genera nuevo random + 14 días + sent_at = now).
    const { data: rpcData, error: rpcErr } = await db.rpc(
      "refresh_org_promoter_claim_token",
      { p_id: orgPromoterId },
    );
    if (rpcErr || typeof rpcData !== "string") {
      return err(rpcErr?.message ?? "claim_token_refresh_failed");
    }
    // Releer expiry recién seteado (now + 14 days) en lugar de calcularlo a mano.
    const { data: refreshed } = await db
      .from("org_promoters")
      .select("claim_token_expires_at")
      .eq("id", orgPromoterId)
      .maybeSingle<{ claim_token_expires_at: string | null }>();
    return ok({
      token: rpcData,
      expiresAt:
        refreshed?.claim_token_expires_at ??
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
  },

  async resolveToken(token): Promise<Result<PromoterClaimContext>> {
    if (!token || token.length < MIN_CLAIM_TOKEN_LENGTH) return err("invalid_token");
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("org_promoters")
      .select("*")
      .eq("claim_token", token)
      .is("deleted_at", null)
      .maybeSingle<PromoterRow>();
    if (error || !data) return err("not_found");
    if (data.profile_id) return err("already_claimed");
    if (!isStillUsable(data)) return err("token_expired_or_used");
    return ok(await buildContext(data, false));
  },

  async consumeToken(
    token,
    profileId,
  ): Promise<Result<PromoterClaimContext>> {
    if (!token || token.length < MIN_CLAIM_TOKEN_LENGTH) return err("invalid_token");
    const db = supabaseAdmin();
    const { data: existing, error: readErr } = await db
      .from("org_promoters")
      .select("*")
      .eq("claim_token", token)
      .is("deleted_at", null)
      .maybeSingle<PromoterRow>();
    if (readErr || !existing) return err("not_found");

    // Idempotente: si ya está reclamado por el mismo profile, devolvemos OK.
    if (existing.profile_id === profileId) {
      return ok(await buildContext(existing, true));
    }
    if (existing.profile_id && existing.profile_id !== profileId) {
      return err("claimed_by_another");
    }
    if (!isStillUsable(existing)) return err("token_expired_or_used");

    // Compare-and-set: solo actualiza si el profile_id sigue null y el token
    // sigue siendo el mismo (evita double-claim concurrente).
    const { data: updated, error: updErr } = await db
      .from("org_promoters")
      .update({
        profile_id: profileId,
        claim_token_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("claim_token", token)
      .is("profile_id", null)
      .select("*")
      .maybeSingle<PromoterRow>();
    if (updErr || !updated) return err("claim_failed");

    // Propagar profile_id a todos los promoter_links del pool de este
    // org_promoter — así useMyPromoterLinks (que filtra por promoter_id) los
    // devuelve y el dashboard /promo los lista. Sin esto los links quedan
    // "huérfanos" aunque el claim haya pasado.
    await db
      .from("promoter_links")
      .update({ promoter_id: profileId })
      .eq("org_promoter_id", existing.id)
      .is("promoter_id", null);

    return ok(await buildContext(updated, false));
  },
};

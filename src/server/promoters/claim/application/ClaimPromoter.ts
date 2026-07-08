import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getAuthContext } from "@/server/_shared/AuthContext";
import type { PromoterClaimRepository } from "../ports/PromoterClaimRepository";
import type { PromoterClaimContext } from "../domain/PromoterClaim";

type Deps = { claims: PromoterClaimRepository };

export type ClaimPromoterInput = {
  token: string;
};

export type ClaimPromoterOutput = {
  context: PromoterClaimContext;
  /** Ruta sugerida post-claim. /promo o /promo?event=<slug>. */
  redirectTo: string;
};

/**
 * Aplica el claim para el usuario autenticado actual. El promotor entra a
 * /c/[token] y, si no está logueado, hace OAuth Google primero (como cualquier
 * usuario). Una vez con sesión activa, este endpoint consume el token,
 * asigna el profile_id al org_promoter y setea phone en el perfil si falta.
 *
 * Idempotente: si el mismo usuario reabre el link después de claim, devuelve
 * OK con `alreadyClaimed=true` en el contexto.
 */
export const claimPromoter = async (
  { claims }: Deps,
  input: ClaimPromoterInput,
): Promise<Result<ClaimPromoterOutput>> => {
  const auth = await getAuthContext();
  if (!auth.ok) return err(auth.error);

  // Resolver token sin consumir para acceder al whatsapp pre-validado y poder
  // setearlo en el perfil incluso si el preview falla por "already_claimed".
  const previewResult = await claims.resolveToken(input.token);
  // Si el token ya fue consumido por este mismo profile, consumeToken devuelve
  // alreadyClaimed=true. Si fue consumido por otro, falla. Si está vivo, lo
  // consume normal. Por eso vamos directo a consumeToken.
  const consumeResult = await claims.consumeToken(input.token, auth.value.profileId);
  if (!consumeResult.ok) return err(consumeResult.error);

  // Setear phone en el perfil desde el whatsapp del org_promoter si todavía
  // está vacío. No machacamos un phone existente.
  const db = supabaseAdmin();
  const whatsapp = consumeResult.value.whatsapp || (previewResult.ok ? previewResult.value.whatsapp : "");
  if (whatsapp) {
    await db
      .from("profiles")
      .update({ phone: whatsapp })
      .eq("id", auth.value.profileId)
      .is("phone", null);
  }

  // Notifica a los admins de la org del claim. Si fue legítimo lo ven y siguen.
  // Si fue otro Google (claim robado), lo detectan y revocan / regeneran token.
  // No bloqueamos el flow si esto falla; es best-effort.
  if (!consumeResult.value.alreadyClaimed) {
    await notifyOrgAdminsOfClaim(consumeResult.value, auth.value.profileId).catch(
      (e) => console.warn("[claimPromoter] notify failed:", (e as Error).message),
    );
  }

  return ok({
    context: consumeResult.value,
    redirectTo: "/promo",
  });
};

async function notifyOrgAdminsOfClaim(
  ctx: PromoterClaimContext,
  claimedByProfileId: string,
): Promise<void> {
  const db = supabaseAdmin();

  // Trae los admins/owners de la org para notificarles a todos.
  const { data: admins } = await db
    .from("memberships")
    .select("profile_id")
    .eq("scope_type", "organization")
    .eq("scope_id", ctx.organizationId)
    .in("role", ["owner", "admin"]);

  if (!admins || admins.length === 0) return;

  // Trae el nombre/email del Google que acaba de hacer claim, para que el
  // organizador detecte si no era el promotor esperado.
  const { data: claimer } = await db
    .from("profiles")
    .select("full_name, email")
    .eq("id", claimedByProfileId)
    .maybeSingle<{ full_name: string | null; email: string | null }>();

  const payload = {
    orgPromoterId: ctx.orgPromoterId,
    promoterName: ctx.promoterName,
    eventTitle: ctx.primaryEventTitle,
    claimedAt: new Date().toISOString(),
    claimedByName: claimer?.full_name ?? null,
    claimedByEmail: claimer?.email ?? null,
  };

  const rows = admins
    .map((m) => (m as { profile_id: string | null }).profile_id)
    .filter((id): id is string => !!id)
    .map((profile_id) => ({
      profile_id,
      kind: "promoter_claimed",
      payload,
    }));

  if (rows.length > 0) {
    await db.from("notifications").insert(rows);
  }
}

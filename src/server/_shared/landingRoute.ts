import "server-only";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Decide a dónde mandar al usuario después del login basándose en sus roles:
 *
 *   1. Es miembro de alguna organización → /org (panel organizador).
 *   2. Está linkeado como promotor (org_promoter.profile_id) → /promo.
 *   3. Nada todavía → /auth/onboarding para elegir tipo de cuenta.
 *
 * Why: el flujo /login y /auth/callback usaban /org como default, lo que dejaba
 * a los promotores que se claimaron por WhatsApp viendo un panel vacío de
 * organizador al volver a entrar.
 */
export const resolveDefaultLanding = async (
  profileId: string,
  locale: string = "es",
): Promise<string> => {
  const db = supabaseAdmin();

  // 1. ¿Miembro de alguna org? (más prioritario porque organizador implica más permisos)
  const { count: orgCount } = await db
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("scope_type", "organization")
    .eq("profile_id", profileId);

  if ((orgCount ?? 0) > 0) {
    return `/${locale}/org`;
  }

  // 2. ¿Linkeado como promotor de alguna org?
  const { count: promoterCount } = await db
    .from("org_promoters")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("deleted_at", null);

  if ((promoterCount ?? 0) > 0) {
    return `/${locale}/promo`;
  }

  // 3. Sin rol todavía — onboarding para elegir camino.
  return `/${locale}/auth/onboarding`;
};

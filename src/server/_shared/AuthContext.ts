import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "./supabase/server";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { err, ok, type Result } from "./result";

export const ACTIVE_ORG_COOKIE = "pasape-active-org";

export type AuthContext = {
  profileId: string;
  email: string | null;
};

// `cache()` deduplica por-request: aunque layout, page y varios controllers
// llamen a getAuthContext() en el mismo render, solo se hace UNA llamada de red
// a supabase.auth.getUser(). Esto evita el rate limit 429 de Supabase Auth.
export const getAuthContext = cache(
  async (): Promise<Result<AuthContext>> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return err("unauthenticated");
    return ok({
      profileId: data.user.id,
      email: data.user.email ?? null,
    });
  },
);

export const getActiveOrgSlug = async (): Promise<string | null> => {
  const store = await cookies();
  return store.get(ACTIVE_ORG_COOKIE)?.value ?? null;
};

const writeActiveCookie = async (slug: string) => {
  const store = await cookies();
  store.set(ACTIVE_ORG_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
};

/**
 * Resuelve la marca activa del usuario. Fuente de verdad: `profiles.last_active_org_id`
 * (persiste entre logins y dispositivos — ej. el celular). La cookie es solo un
 * caché de lectura rápida en el mismo navegador. Orden:
 *   1. última marca guardada en el perfil (si sigue siendo miembro)
 *   2. cookie (si es una marca suya) — cubre el mismo navegador sin perfil aún
 *   3. primera marca (determinista, la más antigua)
 */
export const resolveActiveOrgSlug = async (profileId: string): Promise<string | null> => {
  const store = await cookies();
  const orgs = await supabaseOrganizationRepository.listByMember(profileId);
  if (orgs.length === 0) return null;

  const lastId = await supabaseOrganizationRepository.getLastActiveOrgId(profileId);
  const fromProfile = lastId ? orgs.find((o) => o.id === lastId)?.slug : undefined;

  const cookieSlug = store.get(ACTIVE_ORG_COOKIE)?.value;
  const fromCookie = cookieSlug && orgs.some((o) => o.slug === cookieSlug) ? cookieSlug : undefined;

  const slug = fromProfile ?? fromCookie ?? orgs[0].slug;
  if (slug !== cookieSlug) await writeActiveCookie(slug);
  return slug;
};

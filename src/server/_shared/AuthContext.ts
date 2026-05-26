import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "./supabase/server";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { err, ok, type Result } from "./result";

export const ACTIVE_ORG_COOKIE = "pasape-active-org";

export type AuthContext = {
  profileId: string;
  email: string | null;
};

export const getAuthContext = async (): Promise<Result<AuthContext>> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return err("unauthenticated");
  return ok({
    profileId: data.user.id,
    email: data.user.email ?? null,
  });
};

export const getActiveOrgSlug = async (): Promise<string | null> => {
  const store = await cookies();
  return store.get(ACTIVE_ORG_COOKIE)?.value ?? null;
};

export const resolveActiveOrgSlug = async (profileId: string): Promise<string | null> => {
  const store = await cookies();
  const existing = store.get(ACTIVE_ORG_COOKIE)?.value;
  if (existing) return existing;
  const orgs = await supabaseOrganizationRepository.listByMember(profileId);
  if (orgs.length === 0) return null;
  const slug = orgs[0].slug;
  store.set(ACTIVE_ORG_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return slug;
};

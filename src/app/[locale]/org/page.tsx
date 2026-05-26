import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { OrgHomeClient } from "./OrgHomeClient";

// Auth ya validada en layout.tsx. Acá decidimos onboarding: si el usuario aún
// no tiene marcas, lo mandamos a /org/new server-side (sin destello).
export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const auth = await getAuthContext();
  // El layout ya garantiza auth.ok, pero TS necesita el guard.
  if (!auth.ok) redirect(`/${locale}/login`);

  const orgs = await supabaseOrganizationRepository.listByMember(auth.value.profileId);
  if (orgs.length === 0) {
    redirect(`/${locale}/org/new`);
  }
  return <OrgHomeClient />;
}

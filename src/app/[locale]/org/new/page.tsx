import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { NewOrgClient } from "./NewOrgClient";

// Server-side decide isFirstTime (sin marcas aún) y se lo pasa al cliente como
// prop estática. Cero rebote: layout fullpage vs OrgShell se elige antes del render.
export default async function NewOrgPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const auth = await getAuthContext();
  if (!auth.ok) redirect(`/${locale}/org/login?next=/${locale}/org/new`);

  const orgs = await supabaseOrganizationRepository.listByMember(auth.value.profileId);
  // Si todavía no tiene marca, mandamos al flow único de onboarding —
  // ahí se captura tipo + identidad + contacto + razón social + marca.
  if (orgs.length === 0) {
    redirect(`/${locale}/auth/onboarding?intent=organizer`);
  }

  return <NewOrgClient isFirstTime={false} />;
}

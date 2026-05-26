import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseLegalEntityRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseLegalEntityRepository";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { LegalEntityClient } from "./LegalEntityClient";

export default async function LegalEntityPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const auth = await getAuthContext();
  if (!auth.ok) redirect(`/${locale}/login?next=/${locale}/org/legal-entities/${id}`);

  const entity = await supabaseLegalEntityRepository.findById(id);
  if (!entity) notFound();
  if (entity.createdBy !== auth.value.profileId) notFound();

  // Marcas que cuelgan de esta razón social, para mostrarlas en la página.
  const allOrgs = await supabaseOrganizationRepository.listByMember(auth.value.profileId);
  const orgs = allOrgs.filter((o) => o.legalEntityId === entity.id);

  return (
    <LegalEntityClient
      entity={{
        id: entity.id,
        name: entity.name,
        taxId: entity.taxId,
        country: entity.country,
        slug: entity.slug,
        displayName: entity.displayName,
        logoUrl: entity.logoUrl,
        coverUrl: entity.coverUrl,
        bio: entity.bio,
      }}
      orgs={orgs.map((o) => ({
        id: o.id,
        slug: o.slug,
        name: o.name,
        logoUrl: o.logoUrl,
      }))}
    />
  );
}

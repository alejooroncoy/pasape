import type { Organization, OrgMembership, OrgRole } from "../domain/Organization";
import type { Result } from "@/server/_shared/result";

export interface OrganizationRepository {
  create(input: {
    name: string;
    slug: string;
    legalEntityId: string;
    createdBy: string;
    logoUrl?: string | null;
  }): Promise<Result<Organization>>;
  findBySlug(slug: string): Promise<Organization | null>;
  /**
   * Actualiza campos de la marca. Verifica que `callerId` administre la org
   * (owner|admin|editor). Campos `undefined` no se tocan; `null` los limpia.
   */
  update(input: {
    id: string;
    callerId: string;
    name?: string;
    slug?: string;
    logoUrl?: string | null;
    brandColor?: string | null;
    description?: string | null;
    instagram?: string | null;
  }): Promise<Result<Organization>>;
  listByMember(profileId: string): Promise<Array<Organization & { role: OrgRole }>>;
  /**
   * Persiste la última marca activa del usuario en su perfil (fuente de verdad
   * para restaurarla en cualquier dispositivo tras re-login). Idempotente.
   */
  setLastActiveOrg(profileId: string, orgId: string): Promise<void>;
  /** Lee el id de la última marca activa guardada en el perfil (o null). */
  getLastActiveOrgId(profileId: string): Promise<string | null>;
  /**
   * Counts memberships whose role grants "real ownership" of an org
   * (owner | admin | editor). Excludes operational-only roles (door, reporter).
   * Used to enforce the 5-org-per-account cap.
   */
  countOwningMemberships(profileId: string): Promise<number>;
  addMember(input: { organizationId: string; profileId: string; role: OrgRole }): Promise<Result<OrgMembership>>;
  /**
   * Lista miembros con acceso efectivo a la org, viniendo de cualquier scope
   * (portfolio del owner de la razón social, legal_entity, o organization).
   */
  listMembers(organizationId: string): Promise<
    Array<{
      profileId: string;
      role: OrgRole;
      fullName: string | null;
      email: string | null;
      avatarUrl: string | null;
      // De qué scope viene el acceso (para mostrar contexto en UI).
      grantedVia: "portfolio" | "legal_entity" | "organization";
    }>
  >;
}

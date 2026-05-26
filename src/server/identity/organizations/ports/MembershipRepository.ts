import type { Result } from "@/server/_shared/result";
import type { OrgRole } from "../domain/Organization";
import type { InviteScopeType } from "../domain/Invite";

export type ScopedMembership = {
  profileId: string;
  role: OrgRole;
  scopeType: InviteScopeType;
  scopeId: string;
};

/**
 * Persona con acceso (directo o heredado) a una organización.
 * `via` indica el origen del permiso.
 */
export type OrgAccessGrant = {
  profileId: string;
  fullName: string | null;
  email: string | null;
  role: OrgRole;
  via: InviteScopeType | "legal_entity_owner";
  scopeId: string;
};

export interface MembershipRepository {
  /** Crea o actualiza una membership de cualquier scope. */
  upsert(input: {
    profileId: string;
    role: OrgRole;
    scopeType: InviteScopeType;
    scopeId: string;
  }): Promise<Result<ScopedMembership>>;

  /** Devuelve true si el caller tiene un rol con autoridad (owner|admin) sobre el scope. */
  hasAdminOver(input: {
    profileId: string;
    scopeType: InviteScopeType;
    scopeId: string;
  }): Promise<boolean>;

  /**
   * Lista todas las personas con acceso a una org, sumando:
   *  - memberships directos a la org (scope=organization)
   *  - memberships a la razón social que contiene la org (scope=legal_entity)
   *  - memberships al portafolio del owner de esa razón social (scope=portfolio)
   *  - el owner mismo de la razón social (acceso implícito).
   */
  listPeopleWithAccessToOrg(orgId: string): Promise<Result<OrgAccessGrant[]>>;
}

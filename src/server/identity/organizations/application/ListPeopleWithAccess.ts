import type { MembershipRepository } from "../ports/MembershipRepository";

type Deps = { repo: MembershipRepository };

/**
 * Devuelve todas las personas con acceso a una org, ya sea por membership
 * directo a la marca o por herencia desde la razón social / portafolio.
 *
 * Útil para la pantalla de "Equipo" de una marca, donde queremos mostrar
 * tanto a quien fue invitado directamente como a quien hereda acceso de
 * arriba (p.ej. Martina = jefa de marketing de toda la razón social).
 */
export const listPeopleWithAccess = ({ repo }: Deps, orgId: string) =>
  repo.listPeopleWithAccessToOrg(orgId);

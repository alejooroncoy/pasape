import { err, ok, type Result } from "@/server/_shared/result";
import type { InviteRepository } from "../ports/InviteRepository";
import type { MembershipRepository } from "../ports/MembershipRepository";
import type { OrganizationRepository } from "../ports/OrganizationRepository";
import type { Organization } from "../domain/Organization";
import { inviteStatus } from "../domain/Invite";

type Deps = {
  invites: InviteRepository;
  memberships: MembershipRepository;
  orgs: OrganizationRepository;
};

type Input = { token: string; profileId: string };

export const acceptInvite = async (
  { invites, memberships, orgs }: Deps,
  input: Input,
): Promise<Result<{ org: Organization | null }>> => {
  const invite = await invites.findRowByToken(input.token);
  if (!invite) return err("invite_not_found");

  const status = inviteStatus(invite);
  if (status !== "pending") return err(`invite_${status}`);

  // Invites por WhatsApp (sin email) no tienen ninguna otra prueba de
  // posesión del canal que el link — el gate exige el OTP del teléfono antes
  // de asignar membership. Apagado por default (INVITE_PHONE_OTP_REQUIRED):
  // el envío/verificación de OTP ya existe (send/verify), pero el paso en el
  // frontend del accept page todavía no está construido — activar el flag
  // sin eso bloquearía todos los invites por WhatsApp. Prender cuando el UI
  // esté listo.
  const otpGateEnabled = process.env.INVITE_PHONE_OTP_REQUIRED === "true";
  if (otpGateEnabled && invite.phone && !invite.phoneVerifiedAt) {
    return err("phone_verification_required");
  }

  const upserted = await memberships.upsert({
    profileId: input.profileId,
    role: invite.role,
    scopeType: invite.scope.type,
    scopeId: invite.scope.id,
  });
  if (!upserted.ok) return err(upserted.error);

  const accepted = await invites.markAccepted({
    id: invite.id,
    acceptedBy: input.profileId,
  });
  if (!accepted.ok) return err(accepted.error);

  const reachable = await orgs.listByMember(input.profileId);
  let target: Organization | null = null;
  if (invite.scope.type === "organization") {
    target = reachable.find((o) => o.id === invite.scope.id) ?? null;
  } else if (invite.scope.type === "legal_entity") {
    target = reachable.find((o) => o.legalEntityId === invite.scope.id) ?? reachable[0] ?? null;
  } else {
    target = reachable[0] ?? null;
  }

  return ok({ org: target });
};

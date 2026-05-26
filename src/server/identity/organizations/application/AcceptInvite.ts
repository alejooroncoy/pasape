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

import { err, ok, type Result } from "@/server/_shared/result";
import type { InviteRepository } from "../ports/InviteRepository";
import type { MembershipRepository } from "../ports/MembershipRepository";

type Deps = { invites: InviteRepository; memberships: MembershipRepository };

type Input = { inviteId: string; callerProfileId: string };

export const revokeInvite = async (
  { invites, memberships }: Deps,
  input: Input,
): Promise<Result<void>> => {
  const invite = await invites.findById(input.inviteId);
  if (!invite) return err("invite_not_found");
  if (invite.acceptedAt) return err("invite_accepted");
  if (invite.revokedAt) return ok(undefined);

  const allowed = await memberships.hasAdminOver({
    profileId: input.callerProfileId,
    scopeType: invite.scope.type,
    scopeId: invite.scope.id,
  });
  if (!allowed) return err("forbidden");

  return invites.revoke({ id: invite.id, revokedBy: input.callerProfileId });
};

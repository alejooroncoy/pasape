import { err, type Result } from "@/server/_shared/result";
import type { InviteRepository } from "../ports/InviteRepository";
import type { MembershipRepository } from "../ports/MembershipRepository";
import type { OrgInvite, OrgInviteRole, InviteScope } from "../domain/Invite";

type Deps = { invites: InviteRepository; memberships: MembershipRepository };

type Input = {
  scope: InviteScope;
  callerProfileId: string;
  email: string | null;
  phone: string | null;
  role: OrgInviteRole;
};

export const createInvite = async (
  { invites, memberships }: Deps,
  input: Input,
): Promise<Result<OrgInvite>> => {
  if (!input.email && !input.phone) return err("email_or_phone_required");

  const allowed = await memberships.hasAdminOver({
    profileId: input.callerProfileId,
    scopeType: input.scope.type,
    scopeId: input.scope.id,
  });
  if (!allowed) return err("forbidden");

  return invites.create({
    scope: input.scope,
    invitedBy: input.callerProfileId,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    role: input.role,
  });
};

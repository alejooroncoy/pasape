import { err, type Result } from "@/server/_shared/result";
import type { InviteRepository } from "../ports/InviteRepository";
import type { MembershipRepository } from "../ports/MembershipRepository";
import type { OrgInvite, InvitableOrgRole, InviteScope } from "../domain/Invite";

type Deps = { invites: InviteRepository; memberships: MembershipRepository };

type Input = {
  scope: InviteScope;
  callerProfileId: string;
  email: string | null;
  phone: string | null;
  role: InvitableOrgRole;
};

const normEmail = (raw: string | null): string | null => {
  const e = raw?.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
};

const normPhone = (raw: string | null): string | null => {
  const p = raw?.replace(/[^\d+]/g, "") ?? "";
  return p.length >= 8 ? p : null;
};

export const createInvite = async (
  { invites, memberships }: Deps,
  input: Input,
): Promise<Result<OrgInvite>> => {
  const email = normEmail(input.email);
  const phone = normPhone(input.phone);
  if (!email && !phone) return err("email_or_phone_required");

  const allowed = await memberships.hasAdminOver({
    profileId: input.callerProfileId,
    scopeType: input.scope.type,
    scopeId: input.scope.id,
  });
  if (!allowed) return err("forbidden");

  return invites.create({
    scope: input.scope,
    invitedBy: input.callerProfileId,
    email,
    phone,
    role: input.role,
  });
};

import { err, ok, type Result } from "@/server/_shared/result";
import type { InviteRepository } from "../ports/InviteRepository";
import type { OrganizationRepository } from "../ports/OrganizationRepository";
import { inviteStatus, type OrgInvite, type OrgInviteStatus } from "../domain/Invite";

type Deps = { invites: InviteRepository; orgs: OrganizationRepository };
type Input = { orgSlug: string; callerProfileId: string };

export type InviteWithStatus = OrgInvite & { status: OrgInviteStatus };

export const listInvites = async (
  { invites, orgs }: Deps,
  input: Input,
): Promise<Result<InviteWithStatus[]>> => {
  const org = await orgs.findBySlug(input.orgSlug);
  if (!org) return err("org_not_found");

  const reachable = await orgs.listByMember(input.callerProfileId);
  const me = reachable.find((m) => m.id === org.id);
  if (!me || (me.role !== "owner" && me.role !== "admin")) {
    return err("forbidden");
  }

  const list = await invites.listForOrg(org.id);
  return ok(list.map((i) => ({ ...i, status: inviteStatus(i) })));
};

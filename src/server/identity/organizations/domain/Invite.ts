import type { OrgRole } from "./Organization";

// `owner` no se puede invitar — la transferencia de ownership es flujo aparte.
export type OrgInviteRole = Exclude<OrgRole, "owner">;

export type InviteScopeType = "portfolio" | "legal_entity" | "organization";

export type InviteScope = {
  type: InviteScopeType;
  id: string; // profile_id (portfolio) | legal_entity.id | organization.id
};

export type OrgInviteStatus = "pending" | "accepted" | "expired" | "revoked";

export type OrgInvite = {
  id: string;
  scope: InviteScope;
  invitedBy: string;
  email: string | null;
  phone: string | null;
  role: OrgInviteRole;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type OrgInvitePreview = {
  id: string;
  role: OrgInviteRole;
  expiresAt: string;
  status: OrgInviteStatus;
  scope: InviteScope;
  scopeLabel: string;
  invitedBy: {
    fullName: string | null;
  };
};

export const inviteStatus = (
  i: Pick<OrgInvite, "acceptedAt" | "revokedAt" | "expiresAt">,
): OrgInviteStatus => {
  if (i.acceptedAt) return "accepted";
  if (i.revokedAt) return "revoked";
  if (new Date(i.expiresAt).getTime() < Date.now()) return "expired";
  return "pending";
};

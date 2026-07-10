import type { OrgRole } from "./Organization";

// `owner` no se puede invitar — la transferencia de ownership es flujo aparte.
export type OrgInviteRole = Exclude<OrgRole, "owner">;

/** Roles invitables al panel (admin/editor/reporter). Porteros usan código de puerta. */
export type InvitableOrgRole = Exclude<OrgInviteRole, "door">;

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
  // Verificación OTP del teléfono (solo aplica a invites por WhatsApp, sin email).
  phoneVerifiedAt: string | null;
  otpSendCount: number;
  otpLastSentAt: string | null;
  otpAttempts: number;
};

export type OrgInvitePreview = {
  id: string;
  role: OrgInviteRole;
  expiresAt: string;
  status: OrgInviteStatus;
  scope: InviteScope;
  scopeLabel: string;
  /** Correo al que se envió — quien acepta debe entrar con esa cuenta Google. */
  inviteEmail: string | null;
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

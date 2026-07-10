import type { Result } from "@/server/_shared/result";
import type {
  OrgInvite,
  OrgInviteRole,
  OrgInvitePreview,
  InviteScope,
} from "../domain/Invite";

export interface InviteRepository {
  create(input: {
    scope: InviteScope;
    invitedBy: string;
    email: string | null;
    phone: string | null;
    role: OrgInviteRole;
  }): Promise<Result<OrgInvite>>;

  findByToken(token: string): Promise<OrgInvitePreview | null>;

  findRowByToken(token: string): Promise<OrgInvite | null>;

  findById(id: string): Promise<OrgInvite | null>;

  /** Invites visibles desde el contexto de una org (org-scope + escalados que la cubren). */
  listForOrg(orgId: string): Promise<OrgInvite[]>;

  markAccepted(input: { id: string; acceptedBy: string }): Promise<Result<OrgInvite>>;

  revoke(input: { id: string; revokedBy: string }): Promise<Result<void>>;

  /** Registra un envío de OTP: incrementa otp_send_count y marca otp_last_sent_at. */
  recordOtpSent(id: string): Promise<Result<OrgInvite>>;

  /** Registra un intento fallido de verificación: incrementa otp_attempts. */
  recordOtpFailedAttempt(id: string): Promise<Result<OrgInvite>>;

  /** Marca el teléfono como verificado (phone_verified_at = now()). */
  markPhoneVerified(id: string): Promise<Result<OrgInvite>>;
}

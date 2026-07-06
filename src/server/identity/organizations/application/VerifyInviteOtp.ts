import { err, ok, type Result } from "@/server/_shared/result";
import type { InviteRepository } from "../ports/InviteRepository";
import type { OtpGateway } from "@/server/notifications/ports/OtpGateway";
import { inviteStatus } from "../domain/Invite";

type Deps = {
  invites: InviteRepository;
  otp: OtpGateway;
};

type Input = { token: string; code: string };

const MAX_OTP_ATTEMPTS = 5;

export const verifyInviteOtp = async (
  { invites, otp }: Deps,
  input: Input,
): Promise<Result<{ verified: true }>> => {
  const invite = await invites.findRowByToken(input.token);
  if (!invite) return err("invite_not_found");

  const status = inviteStatus(invite);
  if (status !== "pending") return err(`invite_${status}`);

  if (!invite.phone) return err("invite_has_no_phone");
  if (invite.phoneVerifiedAt) return ok({ verified: true });
  if (invite.otpAttempts >= MAX_OTP_ATTEMPTS) return err("too_many_attempts");

  const approved = await otp.checkCode(invite.phone, input.code).catch(() => false);
  if (!approved) {
    await invites.recordOtpFailedAttempt(invite.id);
    return err("invalid_code");
  }

  const marked = await invites.markPhoneVerified(invite.id);
  if (!marked.ok) return err(marked.error);

  return ok({ verified: true });
};

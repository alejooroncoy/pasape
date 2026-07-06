import { err, ok, type Result } from "@/server/_shared/result";
import type { InviteRepository } from "../ports/InviteRepository";
import type { OtpGateway } from "@/server/notifications/ports/OtpGateway";
import { inviteStatus } from "../domain/Invite";

type Deps = {
  invites: InviteRepository;
  otp: OtpGateway;
};

type Input = { token: string };

const OTP_COOLDOWN_MS = 30_000;
const MAX_OTP_SENDS = 5;

export const sendInviteOtp = async (
  { invites, otp }: Deps,
  input: Input,
): Promise<Result<{ sent: boolean }>> => {
  const invite = await invites.findRowByToken(input.token);
  if (!invite) return err("invite_not_found");

  const status = inviteStatus(invite);
  if (status !== "pending") return err(`invite_${status}`);

  // Solo invites por WhatsApp (sin email) pasan por este gate.
  if (!invite.phone) return err("invite_has_no_phone");
  if (invite.phoneVerifiedAt) return err("already_verified");
  if (invite.otpSendCount >= MAX_OTP_SENDS) return err("too_many_requests");
  if (
    invite.otpLastSentAt &&
    Date.now() - new Date(invite.otpLastSentAt).getTime() < OTP_COOLDOWN_MS
  ) {
    return err("otp_cooldown");
  }
  if (!otp.configured()) return err("otp_not_configured");

  try {
    await otp.sendCode(invite.phone);
  } catch (e) {
    return err(e instanceof Error ? e.message : "otp_send_failed");
  }

  const recorded = await invites.recordOtpSent(invite.id);
  if (!recorded.ok) return err(recorded.error);

  return ok({ sent: true });
};

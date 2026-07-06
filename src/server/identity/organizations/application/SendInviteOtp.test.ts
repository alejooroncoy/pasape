import { describe, expect, it, vi } from "vitest";
import { sendInviteOtp } from "./SendInviteOtp";
import type { InviteRepository } from "../ports/InviteRepository";
import type { OtpGateway } from "@/server/notifications/ports/OtpGateway";
import type { OrgInvite } from "../domain/Invite";

const baseInvite: OrgInvite = {
  id: "invite-1",
  scope: { type: "organization", id: "org-1" },
  invitedBy: "profile-1",
  email: null,
  phone: "+51987654321",
  role: "admin",
  token: "tok",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  acceptedAt: null,
  acceptedBy: null,
  revokedAt: null,
  createdAt: new Date().toISOString(),
  phoneVerifiedAt: null,
  otpSendCount: 0,
  otpLastSentAt: null,
  otpAttempts: 0,
};

const fakeInvites = (overrides: Partial<InviteRepository> = {}): InviteRepository => ({
  create: vi.fn(),
  findByToken: vi.fn(),
  findRowByToken: vi.fn(async () => baseInvite),
  findById: vi.fn(),
  listForOrg: vi.fn(),
  markAccepted: vi.fn(),
  revoke: vi.fn(),
  recordOtpSent: vi.fn(async () => ({ ok: true, value: baseInvite }) as const),
  recordOtpFailedAttempt: vi.fn(),
  markPhoneVerified: vi.fn(),
  ...overrides,
});

const fakeOtp = (overrides: Partial<OtpGateway> = {}): OtpGateway => ({
  providerName: "fake",
  configured: () => true,
  sendCode: vi.fn(async () => {}),
  checkCode: vi.fn(async () => true),
  ...overrides,
});

describe("sendInviteOtp", () => {
  it("envía el código y registra el envío", async () => {
    const otp = fakeOtp();
    const invites = fakeInvites();
    const result = await sendInviteOtp({ invites, otp }, { token: "tok" });
    expect(result).toEqual({ ok: true, value: { sent: true } });
    expect(otp.sendCode).toHaveBeenCalledWith("+51987654321");
    expect(invites.recordOtpSent).toHaveBeenCalledWith("invite-1");
  });

  it("rechaza si el invite no tiene teléfono (es por email)", async () => {
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({ ...baseInvite, phone: null, email: "a@b.com" })),
    });
    const result = await sendInviteOtp({ invites, otp: fakeOtp() }, { token: "tok" });
    expect(result).toEqual({ ok: false, error: "invite_has_no_phone" });
  });

  it("rechaza si ya está verificado", async () => {
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({
        ...baseInvite,
        phoneVerifiedAt: new Date().toISOString(),
      })),
    });
    const result = await sendInviteOtp({ invites, otp: fakeOtp() }, { token: "tok" });
    expect(result).toEqual({ ok: false, error: "already_verified" });
  });

  it("rechaza por cooldown si se pidió hace menos de 30s", async () => {
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({
        ...baseInvite,
        otpLastSentAt: new Date().toISOString(),
      })),
    });
    const result = await sendInviteOtp({ invites, otp: fakeOtp() }, { token: "tok" });
    expect(result).toEqual({ ok: false, error: "otp_cooldown" });
  });

  it("rechaza tras el máximo de envíos", async () => {
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({ ...baseInvite, otpSendCount: 5 })),
    });
    const result = await sendInviteOtp({ invites, otp: fakeOtp() }, { token: "tok" });
    expect(result).toEqual({ ok: false, error: "too_many_requests" });
  });

  it("propaga el error si el proveedor rechaza el envío", async () => {
    const otp = fakeOtp({
      sendCode: vi.fn(async () => {
        throw new Error("twilio 400: bad number");
      }),
    });
    const invites = fakeInvites();
    const result = await sendInviteOtp({ invites, otp }, { token: "tok" });
    expect(result).toEqual({ ok: false, error: "twilio 400: bad number" });
    expect(invites.recordOtpSent).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { verifyInviteOtp } from "./VerifyInviteOtp";
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
  otpSendCount: 1,
  otpLastSentAt: new Date().toISOString(),
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
  recordOtpSent: vi.fn(),
  recordOtpFailedAttempt: vi.fn(async () => ({ ok: true, value: baseInvite }) as const),
  markPhoneVerified: vi.fn(async () => ({ ok: true, value: baseInvite }) as const),
  ...overrides,
});

const fakeOtp = (overrides: Partial<OtpGateway> = {}): OtpGateway => ({
  providerName: "fake",
  configured: () => true,
  sendCode: vi.fn(),
  checkCode: vi.fn(async () => true),
  ...overrides,
});

describe("verifyInviteOtp", () => {
  it("marca el teléfono verificado si el código es correcto", async () => {
    const invites = fakeInvites();
    const otp = fakeOtp();
    const result = await verifyInviteOtp({ invites, otp }, { token: "tok", code: "123456" });
    expect(result).toEqual({ ok: true, value: { verified: true } });
    expect(invites.markPhoneVerified).toHaveBeenCalledWith("invite-1");
  });

  it("registra el intento fallido si el código es incorrecto", async () => {
    const invites = fakeInvites();
    const otp = fakeOtp({ checkCode: vi.fn(async () => false) });
    const result = await verifyInviteOtp({ invites, otp }, { token: "tok", code: "000000" });
    expect(result).toEqual({ ok: false, error: "invalid_code" });
    expect(invites.recordOtpFailedAttempt).toHaveBeenCalledWith("invite-1");
    expect(invites.markPhoneVerified).not.toHaveBeenCalled();
  });

  it("rechaza tras el máximo de intentos", async () => {
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({ ...baseInvite, otpAttempts: 5 })),
    });
    const result = await verifyInviteOtp(
      { invites, otp: fakeOtp() },
      { token: "tok", code: "123456" },
    );
    expect(result).toEqual({ ok: false, error: "too_many_attempts" });
  });

  it("es idempotente si ya estaba verificado", async () => {
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({
        ...baseInvite,
        phoneVerifiedAt: new Date().toISOString(),
      })),
    });
    const otp = fakeOtp();
    const result = await verifyInviteOtp({ invites, otp }, { token: "tok", code: "123456" });
    expect(result).toEqual({ ok: true, value: { verified: true } });
    expect(otp.checkCode).not.toHaveBeenCalled();
  });

  it("trata un error del proveedor como código inválido", async () => {
    const invites = fakeInvites();
    const otp = fakeOtp({
      checkCode: vi.fn(async () => {
        throw new Error("twilio 500");
      }),
    });
    const result = await verifyInviteOtp({ invites, otp }, { token: "tok", code: "123456" });
    expect(result).toEqual({ ok: false, error: "invalid_code" });
  });
});

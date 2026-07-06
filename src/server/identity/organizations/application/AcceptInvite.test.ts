import { afterEach, describe, expect, it, vi } from "vitest";
import { acceptInvite } from "./AcceptInvite";
import type { InviteRepository } from "../ports/InviteRepository";
import type { MembershipRepository } from "../ports/MembershipRepository";
import type { OrganizationRepository } from "../ports/OrganizationRepository";
import type { OrgInvite } from "../domain/Invite";

const basePhoneInvite: OrgInvite = {
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
  findRowByToken: vi.fn(async () => basePhoneInvite),
  findById: vi.fn(),
  listForOrg: vi.fn(),
  markAccepted: vi.fn(async () => ({ ok: true, value: basePhoneInvite }) as const),
  revoke: vi.fn(),
  recordOtpSent: vi.fn(),
  recordOtpFailedAttempt: vi.fn(),
  markPhoneVerified: vi.fn(),
  ...overrides,
});

const fakeMemberships = (): MembershipRepository => ({
  upsert: vi.fn(async () => ({ ok: true, value: undefined }) as never),
  hasAdminOver: vi.fn(async () => true),
  listPeopleWithAccessToOrg: vi.fn(async () => ({ ok: true, value: [] }) as never),
});

const fakeOrgs = (): OrganizationRepository => ({
  create: vi.fn(),
  findBySlug: vi.fn(),
  update: vi.fn(),
  listByMember: vi.fn(async () => []),
  setLastActiveOrg: vi.fn(),
  getLastActiveOrgId: vi.fn(),
  countOwningMemberships: vi.fn(),
  addMember: vi.fn(),
  listMembers: vi.fn(),
});

describe("acceptInvite — gate de OTP de teléfono", () => {
  afterEach(() => {
    delete process.env.INVITE_PHONE_OTP_REQUIRED;
  });

  it("acepta un invite por WhatsApp sin verificar cuando el flag está apagado (default)", async () => {
    const invites = fakeInvites();
    const result = await acceptInvite(
      { invites, memberships: fakeMemberships(), orgs: fakeOrgs() },
      { token: "tok", profileId: "profile-2" },
    );
    expect(result.ok).toBe(true);
  });

  it("bloquea un invite por WhatsApp sin verificar cuando el flag está prendido", async () => {
    process.env.INVITE_PHONE_OTP_REQUIRED = "true";
    const invites = fakeInvites();
    const result = await acceptInvite(
      { invites, memberships: fakeMemberships(), orgs: fakeOrgs() },
      { token: "tok", profileId: "profile-2" },
    );
    expect(result).toEqual({ ok: false, error: "phone_verification_required" });
  });

  it("acepta un invite por WhatsApp ya verificado aunque el flag esté prendido", async () => {
    process.env.INVITE_PHONE_OTP_REQUIRED = "true";
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({
        ...basePhoneInvite,
        phoneVerifiedAt: new Date().toISOString(),
      })),
    });
    const result = await acceptInvite(
      { invites, memberships: fakeMemberships(), orgs: fakeOrgs() },
      { token: "tok", profileId: "profile-2" },
    );
    expect(result.ok).toBe(true);
  });

  it("no aplica el gate a invites por email aunque el flag esté prendido", async () => {
    process.env.INVITE_PHONE_OTP_REQUIRED = "true";
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({
        ...basePhoneInvite,
        phone: null,
        email: "a@b.com",
      })),
    });
    const result = await acceptInvite(
      { invites, memberships: fakeMemberships(), orgs: fakeOrgs() },
      { token: "tok", profileId: "profile-2" },
    );
    expect(result.ok).toBe(true);
  });
});

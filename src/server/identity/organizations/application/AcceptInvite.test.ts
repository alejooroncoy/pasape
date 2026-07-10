import { describe, expect, it, vi } from "vitest";
import { acceptInvite } from "./AcceptInvite";
import type { InviteRepository } from "../ports/InviteRepository";
import type { MembershipRepository } from "../ports/MembershipRepository";
import type { OrganizationRepository } from "../ports/OrganizationRepository";
import type { OrgInvite } from "../domain/Invite";

const baseEmailInvite: OrgInvite = {
  id: "invite-1",
  scope: { type: "organization", id: "org-1" },
  invitedBy: "profile-1",
  email: "invitado@pasape.lat",
  phone: null,
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

const basePhoneInvite: OrgInvite = {
  ...baseEmailInvite,
  email: null,
  phone: "+51987654321",
};

const fakeInvites = (overrides: Partial<InviteRepository> = {}): InviteRepository => ({
  create: vi.fn(),
  findByToken: vi.fn(),
  findRowByToken: vi.fn(async () => baseEmailInvite),
  findById: vi.fn(),
  listForOrg: vi.fn(),
  markAccepted: vi.fn(async () => ({ ok: true, value: baseEmailInvite }) as const),
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

describe("acceptInvite — invite por email (match de cuenta)", () => {
  it("acepta cuando el email de la cuenta coincide con el invitado", async () => {
    const invites = fakeInvites();
    const result = await acceptInvite(
      { invites, memberships: fakeMemberships(), orgs: fakeOrgs() },
      { token: "tok", profileId: "profile-2", profileEmail: "invitado@pasape.lat" },
    );
    expect(result.ok).toBe(true);
  });

  it("rechaza si el email de la cuenta no coincide con el invitado", async () => {
    const invites = fakeInvites();
    const result = await acceptInvite(
      { invites, memberships: fakeMemberships(), orgs: fakeOrgs() },
      { token: "tok", profileId: "profile-2", profileEmail: "otra@cuenta.com" },
    );
    expect(result).toEqual({ ok: false, error: "invite_wrong_account" });
  });
});

describe("acceptInvite — invite por WhatsApp (gate de OTP de teléfono)", () => {
  it("bloquea si el teléfono no está verificado", async () => {
    const invites = fakeInvites({ findRowByToken: vi.fn(async () => basePhoneInvite) });
    const result = await acceptInvite(
      { invites, memberships: fakeMemberships(), orgs: fakeOrgs() },
      { token: "tok", profileId: "profile-2", profileEmail: "cualquiera@x.com" },
    );
    expect(result).toEqual({ ok: false, error: "phone_verification_required" });
  });

  it("acepta si el teléfono ya está verificado", async () => {
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({
        ...basePhoneInvite,
        phoneVerifiedAt: new Date().toISOString(),
      })),
      markAccepted: vi.fn(async () => ({ ok: true, value: basePhoneInvite }) as const),
    });
    const result = await acceptInvite(
      { invites, memberships: fakeMemberships(), orgs: fakeOrgs() },
      { token: "tok", profileId: "profile-2", profileEmail: null },
    );
    expect(result.ok).toBe(true);
  });
});

describe("acceptInvite — roles deprecados", () => {
  it("rechaza invites con rol door", async () => {
    const invites = fakeInvites({
      findRowByToken: vi.fn(async () => ({ ...baseEmailInvite, role: "door" as const })),
    });
    const result = await acceptInvite(
      { invites, memberships: fakeMemberships(), orgs: fakeOrgs() },
      { token: "tok", profileId: "profile-2", profileEmail: "invitado@pasape.lat" },
    );
    expect(result).toEqual({ ok: false, error: "invite_role_deprecated" });
  });
});

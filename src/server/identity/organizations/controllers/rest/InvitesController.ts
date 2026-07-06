import { z } from "zod";
import { headers } from "next/headers";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext, getActiveOrgSlug } from "@/server/_shared/AuthContext";
import { supabaseOrganizationRepository } from "../../infrastructure/repositories/SupabaseOrganizationRepository";
import { supabaseInviteRepository } from "../../infrastructure/repositories/SupabaseInviteRepository";
import { supabaseMembershipRepository } from "../../infrastructure/repositories/SupabaseMembershipRepository";
import { createInvite } from "../../application/CreateInvite";
import { acceptInvite } from "../../application/AcceptInvite";
import { sendInviteOtp } from "../../application/SendInviteOtp";
import { verifyInviteOtp } from "../../application/VerifyInviteOtp";
import { dispatchTeamInviteNotification } from "../../application/dispatchTeamInviteNotification";
import { listInvites, type InviteWithStatus } from "../../application/ListInvites";
import { revokeInvite } from "../../application/RevokeInvite";
import { isTeamInviteWhatsAppEnabled } from "../../teamInviteChannels";
import { otpGateway } from "@/server/notifications/infrastructure/otp";
import { supabaseUserRepository } from "@/server/identity/infrastructure/repositories/SupabaseUserRepository";
import { supabaseLegalEntityRepository } from "../../infrastructure/repositories/SupabaseLegalEntityRepository";
import type { InvitableOrgRole, OrgInvitePreview, InviteScopeType } from "../../domain/Invite";
import type { Organization, OrgRole } from "../../domain/Organization";

const resolveScopeLabel = async (
  scopeType: InviteScopeType,
  scopeId: string,
  fallback: string,
): Promise<string> => {
  if (scopeType === "organization") {
    return fallback;
  }
  if (scopeType === "legal_entity") {
    const e = await supabaseLegalEntityRepository.findById(scopeId);
    return e?.name ?? fallback;
  }
  const owner = await supabaseUserRepository.findById(scopeId);
  return owner?.fullName ? `Portafolio de ${owner.fullName}` : "Portafolio";
};

const deps = {
  invites: supabaseInviteRepository,
  orgs: supabaseOrganizationRepository,
  memberships: supabaseMembershipRepository,
};

const INVITABLE_ROLES: InvitableOrgRole[] = ["admin", "editor", "reporter"];
const SCOPE_VALUES: InviteScopeType[] = ["portfolio", "legal_entity", "organization"];

const createSchema = z
  .object({
    channel: z.enum(["email", "whatsapp"]).default("email"),
    email: z.string().email().optional(),
    phone: z
      .string()
      .regex(/^\+?\d{8,15}$/, "Número inválido. Usa formato internacional (+51 9...).")
      .optional(),
    role: z.enum(INVITABLE_ROLES as [InvitableOrgRole, ...InvitableOrgRole[]]).default("admin"),
    scopeType: z.enum(SCOPE_VALUES as [InviteScopeType, ...InviteScopeType[]]).optional(),
    scopeId: z.string().uuid().optional(),
  })
  .refine(
    (v) => (v.channel === "email" ? Boolean(v.email) : Boolean(v.phone)),
    { message: "Falta el destinatario.", path: ["email"] },
  );

const sanitizeHost = (raw: string): string => {
  let h = raw.trim();
  if (h.startsWith("http://")) h = h.slice("http://".length);
  else if (h.startsWith("https://")) h = h.slice("https://".length);
  const slashAt = h.indexOf("/");
  if (slashAt > -1) h = h.slice(0, slashAt);
  return h || "pasape.lat";
};

const buildInviteUrl = async (token: string): Promise<string> => {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return `${envUrl.replace(/\/+$/, "")}/es/invites/${token}`;
  const h = await headers();
  const host = sanitizeHost(h.get("x-forwarded-host") ?? h.get("host") ?? "pasape.lat");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/es/invites/${token}`;
};

export type ListInvitesResponse = {
  members: Array<{
    profileId: string;
    role: OrgRole;
    fullName: string | null;
    email: string | null;
    avatarUrl: string | null;
    grantedVia: "portfolio" | "legal_entity" | "organization";
  }>;
  invites: Array<InviteWithStatus>;
};

export const InvitesController = {
  async list(): Promise<Result<ListInvitesResponse>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const slug = await getActiveOrgSlug();
    if (!slug) return err("no_active_org");

    const org = await supabaseOrganizationRepository.findBySlug(slug);
    if (!org) return err("org_not_found");

    const result = await listInvites(deps, {
      orgSlug: slug,
      callerProfileId: auth.value.profileId,
    });
    if (!result.ok) return err(result.error);

    const members = await supabaseOrganizationRepository.listMembers(org.id);
    return ok({ members, invites: result.value });
  },

  async create(
    input: unknown,
  ): Promise<
    Result<{
      id: string;
      expiresAt: string;
      sent: boolean;
      channel: "email" | "whatsapp";
      destination: string;
    }>
  > {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);

    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");

    const channel = parsed.data.channel;
    if (channel === "whatsapp" && !isTeamInviteWhatsAppEnabled()) {
      return err("invite_whatsapp_disabled");
    }

    let scopeType = parsed.data.scopeType;
    let scopeId = parsed.data.scopeId;
    let scopeFallbackLabel = "una marca";
    if (!scopeType || !scopeId) {
      const slug = await getActiveOrgSlug();
      if (!slug) return err("no_active_org");
      const org = await supabaseOrganizationRepository.findBySlug(slug);
      if (!org) return err("org_not_found");
      scopeType = "organization";
      scopeId = org.id;
      scopeFallbackLabel = org.name;
    } else if (scopeType === "organization") {
      const org = await supabaseOrganizationRepository.findBySlug(
        (await getActiveOrgSlug()) ?? "",
      );
      if (org?.id === scopeId) scopeFallbackLabel = org.name;
    }

    const destination =
      channel === "email"
        ? parsed.data.email!.trim().toLowerCase()
        : parsed.data.phone!.trim();

    const result = await createInvite(deps, {
      callerProfileId: auth.value.profileId,
      email: channel === "email" ? destination : null,
      phone: channel === "whatsapp" ? destination : null,
      role: parsed.data.role,
      scope: { type: scopeType, id: scopeId },
    });
    if (!result.ok) return err(result.error);

    const inviteUrl = await buildInviteUrl(result.value.token);

    const [scopeLabel, inviter] = await Promise.all([
      resolveScopeLabel(scopeType, scopeId, scopeFallbackLabel),
      supabaseUserRepository.findById(auth.value.profileId),
    ]);

    const sent = await dispatchTeamInviteNotification({
      channel,
      destination,
      token: result.value.token,
      inviteUrl,
      expiresAt: result.value.expiresAt,
      role: parsed.data.role,
      scopeLabel,
      inviterName: inviter?.fullName ?? null,
    });

    return ok({
      id: result.value.id,
      expiresAt: result.value.expiresAt,
      sent,
      channel,
      destination,
    });
  },

  async revoke(id: string): Promise<Result<void>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return revokeInvite(deps, { inviteId: id, callerProfileId: auth.value.profileId });
  },

  async preview(token: string): Promise<Result<OrgInvitePreview>> {
    const data = await supabaseInviteRepository.findByToken(token);
    if (!data) return err("invite_not_found");
    return ok(data);
  },

  async accept(token: string): Promise<Result<{ org: Organization | null }>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return acceptInvite(deps, {
      token,
      profileId: auth.value.profileId,
      profileEmail: auth.value.email,
    });
  },

  // OTP del teléfono para invites por WhatsApp (creación hoy apagada por
  // TEAM_INVITE_WHATSAPP_ENABLED — ver teamInviteChannels.ts). acceptInvite()
  // exige phoneVerifiedAt para cualquier invite sin email, así que estos
  // endpoints ya quedan listos para cuando se reactive el canal.
  async sendOtp(token: string): Promise<Result<{ sent: boolean }>> {
    return sendInviteOtp({ invites: supabaseInviteRepository, otp: otpGateway() }, { token });
  },

  async verifyOtp(token: string, code: string): Promise<Result<{ verified: true }>> {
    return verifyInviteOtp(
      { invites: supabaseInviteRepository, otp: otpGateway() },
      { token, code },
    );
  },
};

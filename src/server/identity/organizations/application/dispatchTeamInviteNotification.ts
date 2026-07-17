import { headers } from "next/headers";
import { inviteEmailSender } from "@/server/notifications/infrastructure/InviteEmailSender";
import { inviteWhatsAppSender } from "@/server/notifications/infrastructure/InviteWhatsAppSender";
import type { InvitableOrgRole } from "../domain/Invite";

const sanitizeHost = (raw: string): string => {
  let h = raw.trim();
  if (h.startsWith("http://")) h = h.slice("http://".length);
  else if (h.startsWith("https://")) h = h.slice("https://".length);
  const slashAt = h.indexOf("/");
  if (slashAt > -1) h = h.slice(0, slashAt);
  return h || "pasape.lat";
};

export const buildInviteUrl = async (token: string): Promise<string> => {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return `${envUrl.replace(/\/+$/, "")}/es/invites/${token}`;
  const h = await headers();
  const host = sanitizeHost(h.get("x-forwarded-host") ?? h.get("host") ?? "pasape.lat");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/es/invites/${token}`;
};

export type TeamInviteChannel = "email" | "whatsapp";

const ROLE_LABEL: Record<InvitableOrgRole, string> = {
  admin: "Administrador",
  editor: "Editor",
  reporter: "Solo lectura",
};

export type DispatchTeamInviteInput = {
  channel: TeamInviteChannel;
  destination: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  role: InvitableOrgRole;
  scopeLabel: string;
  inviterName: string | null;
};

/** Envía el invite por el canal elegido. Listo para reactivar WhatsApp con TEAM_INVITE_WHATSAPP_ENABLED. */
export async function dispatchTeamInviteNotification(
  input: DispatchTeamInviteInput,
): Promise<boolean> {
  const roleLabel = ROLE_LABEL[input.role];

  if (input.channel === "email") {
    return inviteEmailSender.send({
      to: input.destination,
      inviterName: input.inviterName,
      scopeLabel: input.scopeLabel,
      roleLabel,
      inviteUrl: input.inviteUrl,
      expiresAt: input.expiresAt,
    });
  }

  return inviteWhatsAppSender.send({
    to: input.destination,
    inviterName: input.inviterName,
    scopeLabel: input.scopeLabel,
    roleLabel,
    token: input.token,
    expiresAt: input.expiresAt,
  });
}

import { inviteEmailSender } from "@/server/notifications/infrastructure/InviteEmailSender";
import { inviteWhatsAppSender } from "@/server/notifications/infrastructure/InviteWhatsAppSender";
import type { InvitableOrgRole } from "../domain/Invite";

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

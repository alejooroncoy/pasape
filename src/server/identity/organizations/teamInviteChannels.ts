/** WhatsApp para invites de equipo — off hasta Meta Business + plantillas. */
export const isTeamInviteWhatsAppEnabled = (): boolean =>
  process.env.TEAM_INVITE_WHATSAPP_ENABLED === "true";

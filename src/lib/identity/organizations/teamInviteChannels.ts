/** Espejo cliente de TEAM_INVITE_WHATSAPP_ENABLED — solo para mostrar canal en UI. */
export const isTeamInviteWhatsAppEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_TEAM_INVITE_WHATSAPP_ENABLED === "true";

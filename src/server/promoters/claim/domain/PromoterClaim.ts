/**
 * Datos del org_promoter resueltos por su claim_token. El promotor toca el link
 * en el WhatsApp y aterrizamos en /p/[token]; el backend resuelve esto para
 * mostrarle una landing personalizada antes de activar la sesión.
 */
export type PromoterClaimContext = {
  orgPromoterId: string;
  organizationId: string;
  organizationName: string;
  promoterName: string;
  whatsapp: string; // E.164 sin "+"
  /** null = hereda de la marca. */
  defaultCommissionPct: number | null;
  /** Slug del evento más reciente asignado al promotor (para redirect post-claim). */
  primaryEventSlug: string | null;
  primaryEventTitle: string | null;
  /** Profile_id ya existía y fue linkeado en este claim (idempotente). */
  alreadyClaimed: boolean;
};


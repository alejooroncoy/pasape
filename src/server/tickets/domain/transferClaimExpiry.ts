/** Link de canje: lo que ocurra primero entre 7 días desde el envío y el fin del evento. */
export const TRANSFER_CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const transferClaimExpiresAt = (
  eventEndsAt: string | null,
  nowMs: number = Date.now(),
): string => {
  const capMs = nowMs + TRANSFER_CLAIM_TTL_MS;
  if (eventEndsAt != null) {
    const endMs = new Date(eventEndsAt).getTime();
    if (!Number.isNaN(endMs)) {
      return new Date(Math.min(capMs, endMs)).toISOString();
    }
  }
  return new Date(capMs).toISOString();
};

export const isTransferClaimExpired = (params: {
  expiresAt: string | null;
  eventEndsAt: string | null;
  now?: Date;
}): boolean => {
  const now = params.now ?? new Date();
  if (params.expiresAt != null && new Date(params.expiresAt) < now) return true;
  if (params.eventEndsAt != null && new Date(params.eventEndsAt) < now) return true;
  return false;
};

import { createHmac, timingSafeEqual } from "crypto";

// Short token para acceso público al QR sin login. HMAC-SHA256(secret, ticketId)
// truncado a 16 chars hex (64 bits). Suficiente para mitigar enumeración dado
// que el ticketId ya es uuid v4.

const secret = (): string => {
  const s = process.env.TICKET_LINK_SECRET;
  if (!s) throw new Error("Missing env var: TICKET_LINK_SECRET");
  return s;
};

export const signTicketLink = (ticketId: string): string =>
  createHmac("sha256", secret()).update(ticketId).digest("hex").slice(0, 16);

export const verifyTicketLink = (ticketId: string, token: string): boolean => {
  if (!token || token.length !== 16) return false;
  const expected = signTicketLink(ticketId);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
};

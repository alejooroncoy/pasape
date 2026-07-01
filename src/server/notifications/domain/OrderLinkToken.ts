import { createHmac, timingSafeEqual } from "crypto";

// Token corto para "desbloquear" una compra sin enumerar orderIds. Misma idea
// que TicketLinkToken pero con prefijo de dominio ("order:") para que un token
// de ticket nunca se confunda con uno de orden aunque compartan el secret.
// HMAC-SHA256(secret, "order:"+orderId) truncado a 16 chars hex (64 bits);
// suficiente dado que orderId ya es uuid v4.

const secret = (): string => {
  const s = process.env.TICKET_LINK_SECRET;
  if (!s) throw new Error("Missing env var: TICKET_LINK_SECRET");
  return s;
};

export const signOrderLink = (orderId: string): string =>
  createHmac("sha256", secret()).update(`order:${orderId}`).digest("hex").slice(0, 16);

export const verifyOrderLink = (orderId: string, token: string): boolean => {
  if (!token || token.length !== 16) return false;
  const expected = signOrderLink(orderId);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
};

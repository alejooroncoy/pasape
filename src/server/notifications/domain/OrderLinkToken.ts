import { createHmac, timingSafeEqual } from "crypto";
import { LINK_TOKEN_HEX_LENGTH } from "./linkTokenConfig";

// Token corto para "desbloquear" una compra sin enumerar orderIds. Misma idea
// que TicketLinkToken pero con prefijo de dominio ("order:") para que un token
// de ticket nunca se confunda con uno de orden aunque compartan el secret.
// HMAC-SHA256(secret, "order:"+orderId) truncado a LINK_TOKEN_HEX_LENGTH chars
// hex (64 bits); suficiente dado que orderId ya es uuid v4.

const secret = (): string => {
  const s = process.env.TICKET_LINK_SECRET;
  if (!s) throw new Error("Missing env var: TICKET_LINK_SECRET");
  return s;
};

export const signOrderLink = (orderId: string): string =>
  createHmac("sha256", secret())
    .update(`order:${orderId}`)
    .digest("hex")
    .slice(0, LINK_TOKEN_HEX_LENGTH);

export const verifyOrderLink = (orderId: string, token: string): boolean => {
  if (!token || token.length !== LINK_TOKEN_HEX_LENGTH) return false;
  const expected = signOrderLink(orderId);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
};

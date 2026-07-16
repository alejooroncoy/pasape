import { createHmac, timingSafeEqual } from "crypto";
import { LINK_TOKEN_HEX_LENGTH } from "./linkTokenConfig";

// Short token para acceso público al QR sin login. HMAC-SHA256(secret, payload)
// truncado a LINK_TOKEN_HEX_LENGTH chars hex (64 bits). Suficiente para
// mitigar enumeración dado que el ticketId ya es uuid v4.
//
// El payload incluye `transfer_count` para que el token ROTE en cada
// transferencia: sin esto, el token dependía solo del ticketId y NO cambiaba al
// transferir, así que el comprador original conservaba una llave válida para
// re-emitir el QR (sobrescribir signing_pub) de una entrada que ya regaló/vendió.
// Al ligar el token al transfer_count actual, el link del emisor deja de validar
// apenas el receptor reclama (claimTransfer incrementa transfer_count).
//
// Compatibilidad: transfer_count 0 (entradas nunca transferidas, la enorme
// mayoría) usa el payload legacy = ticketId, así que los links `?k=` ya emitidos
// (en correos/wallets) siguen funcionando. Solo cambia para count > 0.

const secret = (): string => {
  const s = process.env.TICKET_LINK_SECRET;
  if (!s) throw new Error("Missing env var: TICKET_LINK_SECRET");
  return s;
};

const linkPayload = (ticketId: string, transferCount: number): string =>
  transferCount > 0 ? `${ticketId}:${transferCount}` : ticketId;

export const signTicketLink = (ticketId: string, transferCount = 0): string =>
  createHmac("sha256", secret())
    .update(linkPayload(ticketId, transferCount))
    .digest("hex")
    .slice(0, LINK_TOKEN_HEX_LENGTH);

export const verifyTicketLink = (
  ticketId: string,
  token: string,
  transferCount = 0,
): boolean => {
  if (!token || token.length !== LINK_TOKEN_HEX_LENGTH) return false;
  const expected = signTicketLink(ticketId, transferCount);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
};

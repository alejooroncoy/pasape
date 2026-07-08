import { createHmac } from "crypto";

// Hash HMAC compartido para las señales anti-bot que NO deben guardar PII cruda:
// email/teléfono (contact), DNI, y tarjeta. Un solo lugar para que el mismo valor
// produzca el mismo hash desde cualquier punto del flujo (checkout y pago) y las
// correlaciones cuadren. Prefijo de dominio para que un contact y un dni iguales
// nunca colisionen. Trunca a 32 hex (128 bits): suficiente para correlacionar,
// no reversible.
export const signalHash = (domain: string, value: string | null | undefined): string | null => {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  const secret = process.env.TICKET_LINK_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`${domain}:${v}`).digest("hex").slice(0, 32);
};

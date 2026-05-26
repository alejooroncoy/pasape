import { createHmac, timingSafeEqual } from "node:crypto";

// Sistema de QR rotante. Cada 10 segundos el código cambia. El secreto vive
// en DB (tickets.rotation_secret) y nunca se expone al cliente. El cliente
// pide el código actual al server cada N segundos; el escáner de puerta
// valida el código contra el secreto recomputando el HMAC.

export const WINDOW_SECONDS = 10;
// Tolerancia ±1 window para clock skew (puerta vs cliente). Total 30s de
// vida útil efectiva por código.
export const WINDOW_TOLERANCE = 1;
export const CODE_LENGTH = 12;

export const currentWindow = (now: number = Date.now()): number =>
  Math.floor(now / 1000 / WINDOW_SECONDS);

export const computeRotatingCode = (
  secret: Buffer,
  ticketId: string,
  windowIdx: number,
): string => {
  const mac = createHmac("sha256", secret)
    .update(`${ticketId}|${windowIdx}`)
    .digest("base64url");
  return mac.slice(0, CODE_LENGTH);
};

export type RotatingPayload = {
  ticketId: string;
  windowIdx: number;
  code: string;
};

export const buildRotatingPayload = (p: RotatingPayload): string =>
  `${p.ticketId}.${p.windowIdx}.${p.code}`;

export const parseRotatingPayload = (raw: string): RotatingPayload | null => {
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [ticketId, w, code] = parts;
  if (!ticketId || !w || !code) return null;
  const windowIdx = Number(w);
  if (!Number.isFinite(windowIdx) || windowIdx <= 0) return null;
  return { ticketId, windowIdx, code };
};

/**
 * Verifica que `code` sea válido para `ticketId` en `windowIdx`, considerando
 * tolerancia ±WINDOW_TOLERANCE windows. Devuelve el window aceptado o null.
 * Usa timingSafeEqual para mitigar timing attacks.
 */
export const verifyRotatingCode = (
  secret: Buffer,
  ticketId: string,
  claimedWindow: number,
  code: string,
): { valid: true; window: number } | { valid: false } => {
  if (code.length !== CODE_LENGTH) return { valid: false };
  const now = currentWindow();
  if (Math.abs(claimedWindow - now) > WINDOW_TOLERANCE) return { valid: false };
  for (let delta = -WINDOW_TOLERANCE; delta <= WINDOW_TOLERANCE; delta++) {
    const win = claimedWindow + delta;
    const expected = computeRotatingCode(secret, ticketId, win);
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(code);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return { valid: true, window: win };
      }
    } catch {
      // continue
    }
  }
  return { valid: false };
};

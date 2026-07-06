/** Sanitización de inputs de usuario — isomórfico (client + server).
 *  Quita controles/HTML obvio y normaliza; la validación de negocio sigue en zod. */

const CTRL_RE = /[\u0000-\u001F\u007F-\u009F]/g;

export const stripControlChars = (raw: string): string => raw.replace(CTRL_RE, "");

export const collapseSpaces = (raw: string): string => raw.replace(/\s+/g, " ").trim();

/** Nombre de persona: letras (unicode), espacios, guión, apóstrofo, punto. */
export const sanitizePersonName = (raw: string, maxLen = 120): string => {
  let s = collapseSpaces(stripControlChars(raw));
  s = s.replace(/[<>&"`\\]/g, "");
  s = s.replace(/[^\p{L}\p{M}\s'.-]/gu, "");
  return s.slice(0, maxLen);
};

export const sanitizeEmail = (raw: string): string =>
  collapseSpaces(stripControlChars(raw)).toLowerCase().slice(0, 254);

export const sanitizeDocument = (raw: string, isForeigner: boolean): string => {
  const s = stripControlChars(raw).trim();
  if (isForeigner) {
    return s.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20);
  }
  return s.replace(/\D/g, "").slice(0, 8);
};

/** Teléfono: conserva + inicial y solo dígitos (E.164). */
export const sanitizePhone = (raw: string): string => {
  const s = stripControlChars(raw).trim();
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  return `${hasPlus ? "+" : ""}${digits}`.slice(0, 16);
};

export const sanitizePromoCode = (raw: string): string =>
  stripControlChars(raw).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 64);

export type GuestContactInput = {
  email?: string | null;
  phone?: string | null;
  fullName: string;
  dni: string;
  isForeigner?: boolean;
};

export const sanitizeGuestContact = (g: GuestContactInput): GuestContactInput => ({
  ...g,
  email: g.email?.trim() ? sanitizeEmail(g.email) : g.email ?? null,
  phone: g.phone?.trim() ? sanitizePhone(g.phone) : g.phone ?? null,
  fullName: sanitizePersonName(g.fullName),
  dni: sanitizeDocument(g.dni, !!g.isForeigner),
});

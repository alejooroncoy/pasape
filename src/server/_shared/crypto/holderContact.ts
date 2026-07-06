import { decryptText, encryptText } from "./pii";

/** Email del holder: minúsculas, sin espacios extremos. */
export const normalizeHolderEmail = (raw: string | null | undefined): string =>
  (raw ?? "").trim().toLowerCase();

/** Teléfono del holder: solo dígitos (E.164 sin +). */
export const normalizeHolderPhone = (raw: string | null | undefined): string =>
  (raw ?? "").replace(/\D/g, "");

export const encryptHolderEmail = (raw: string | null | undefined): string | null => {
  const email = normalizeHolderEmail(raw);
  return email ? encryptText(email) : null;
};

export const encryptHolderPhone = (raw: string | null | undefined): string | null => {
  const phone = normalizeHolderPhone(raw);
  return phone ? encryptText(phone) : null;
};

export const decryptHolderEmail = (enc: string | null | undefined): string | null =>
  decryptText(enc);

export const decryptHolderPhone = (enc: string | null | undefined): string | null =>
  decryptText(enc);

type HolderContactRow = {
  holder_email?: string | null;
  holder_email_enc?: string | null;
  holder_phone?: string | null;
  holder_phone_enc?: string | null;
};

/** Dual-read: *_enc primero, columna plana legacy como fallback. */
export const resolveHolderEmail = (row: HolderContactRow): string | null =>
  decryptHolderEmail(row.holder_email_enc) ?? row.holder_email?.trim().toLowerCase() ?? null;

export const resolveHolderPhone = (row: HolderContactRow): string | null => {
  const fromEnc = decryptHolderPhone(row.holder_phone_enc);
  if (fromEnc) return fromEnc;
  const legacy = normalizeHolderPhone(row.holder_phone);
  return legacy || null;
};

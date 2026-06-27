import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// Cifrado del DNI del holder en reposo. El DNI completo se guarda CIFRADO
// (tickets.holder_dni_enc) para poder mostrarlo en la lista/Excel del
// organizador, pero un dump de la BD NO lo expone: la clave vive en env
// (DNI_ENC_KEY), fuera de la tabla. A los celulares del portero nunca viaja el
// DNI completo — solo los últimos 4 dígitos (no identificables).
//
// AES-256-GCM (autenticado). Formato persistido: base64(iv[12] | tag[16] | ct).

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

const getKey = (): Buffer => {
  const raw = process.env.DNI_ENC_KEY;
  if (!raw) throw new Error("Missing env var: DNI_ENC_KEY");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("DNI_ENC_KEY debe ser 32 bytes en base64 (AES-256)");
  }
  return key;
};

/** Normaliza un DNI a solo dígitos (lo que entra a cifrar/derivar). */
export const normalizeDni = (raw: string | null | undefined): string =>
  (raw ?? "").replace(/\D/g, "");

/** Últimos 4 dígitos del DNI — lo único que viaja al offline del portero. */
export const dniLast4 = (raw: string | null | undefined): string | null => {
  const d = normalizeDni(raw);
  return d ? d.slice(-4) : null;
};

/** Cifra el DNI completo. Devuelve null si el DNI viene vacío. */
export const encryptDni = (raw: string | null | undefined): string | null => {
  const dni = normalizeDni(raw);
  if (!dni) return null;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(dni, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
};

/** Descifra el DNI. Devuelve null si viene vacío o el dato es inválido. */
export const decryptDni = (enc: string | null | undefined): string | null => {
  if (!enc) return null;
  try {
    const buf = Buffer.from(enc, "base64");
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
};

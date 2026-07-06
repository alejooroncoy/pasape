import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// Cifrado genérico de PII en reposo. Reutiliza DNI_ENC_KEY (32 bytes base64).
// Formato: base64(iv[12] | tag[16] | ct)

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

export const encryptText = (plain: string | null | undefined): string | null => {
  const text = (plain ?? "").trim();
  if (!text) return null;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
};

export const decryptText = (enc: string | null | undefined): string | null => {
  if (!enc) return null;
  try {
    const buf = Buffer.from(enc, "base64");
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
};

/** Máscara para columnas legacy legibles en dumps sin PII completa. */
export const maskDocNumber = (raw: string): string => {
  const d = raw.replace(/\D/g, "");
  if (d.length <= 4) return "****";
  return `****${d.slice(-4)}`;
};

export const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const head = (local ?? "").slice(0, 1) || "*";
  return `${head}***@${domain}`;
};

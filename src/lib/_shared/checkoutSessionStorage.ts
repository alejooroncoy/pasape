/** Estado de checkout en sessionStorage: cifrado simétrico por orderId.
 *  Obfuscación frente a DevTools/extensiones casuales — no protege contra XSS
 *  (el atacante ejecuta el mismo JS). La pestaña cerrada borra todo igual. */

const PREFIX = "v1:";
const PEPPER = "pasape:checkout:seal:v1";

const toBase64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
};

const fromBase64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const deriveKey = async (orderId: string): Promise<CryptoKey> => {
  const material = new TextEncoder().encode(`${PEPPER}:${orderId}`);
  const hash = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

export const sealCheckoutSession = async (orderId: string, payload: unknown): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(orderId);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  const packed = new Uint8Array(iv.length + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), iv.length);
  return `${PREFIX}${toBase64(packed)}`;
};

export const openCheckoutSession = async (orderId: string, raw: string): Promise<unknown | null> => {
  if (!raw.startsWith(PREFIX)) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  try {
    const packed = fromBase64(raw.slice(PREFIX.length));
    const iv = packed.slice(0, 12);
    const cipher = packed.slice(12);
    const key = await deriveKey(orderId);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return JSON.parse(new TextDecoder().decode(plain)) as unknown;
  } catch {
    return null;
  }
};

export const checkoutSessionKey = (orderId: string): string => `pasape:buy:${orderId}`;

import {
  SignJWT,
  jwtVerify,
  importJWK,
  exportJWK,
  generateKeyPair,
  type JWK,
} from "jose";
import { WINDOW_TOLERANCE, currentWindow } from "./RotatingQr";

// Validación offline asimétrica de tickets (reemplaza el HMAC simétrico).
//
// Dos niveles de PKI ECDSA P-256:
//   - Nivel evento: par del evento. La privada firma certificados de ticket y
//     vive solo en el server. La pública se sirve al portero (cacheada offline).
//   - Nivel ticket: par generado en el DEVICE del comprador (privada NO-extraíble,
//     nunca sale del device). El server firma un cert que liga la pública del
//     ticket al evento.
//
// QR rotativo (cada 10s, generado offline en el device):
//   cert ~ windowIdx ~ sign(priv_ticket, "ticketId|windowIdx")
//
// El portero verifica 100% offline con la pública del evento:
//   1. verifyCert(pub_evento, cert)        → confirma datos + ticket_pub
//   2. verifyWindow(ticket_pub, windowIdx) → fresco ⇒ anti-screenshot
//
// Módulo isomórfico: usa `jose` (Web Crypto) + globalThis.crypto.subtle, sin
// dependencias de node. Corre igual en server (node webcrypto) y cliente.

const ALG = "ES256";
const CURVE = "P-256";

// El cert sobrevive el uso offline durante el evento; el anti-screenshot lo da
// la firma de window (≤30s), no el exp del cert. Se reemite al transferir.
const DEFAULT_CERT_TTL_SECONDS = 60 * 60 * 36; // 36h

export type TicketCertClaims = {
  ticketId: string;
  holderName: string | null;
  dniLast2: string | null;
  zoneId: string | null;
  /** Pública del ticket (JWK), generada en el device del comprador. */
  ticketPub: JWK;
};

// ── Par del evento ──────────────────────────────────────────────────────────

export async function generateEventKeypair(): Promise<{
  publicJwk: JWK;
  privateJwk: JWK;
}> {
  const { publicKey, privateKey } = await generateKeyPair(ALG, {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  publicJwk.alg = ALG;
  privateJwk.alg = ALG;
  return { publicJwk, privateJwk };
}

// ── Certificado de ticket (JWS firmado con la privada del evento) ────────────

export async function signTicketCert(
  eventPrivateJwk: JWK,
  claims: TicketCertClaims,
  opts: { ttlSeconds?: number; now?: number } = {},
): Promise<string> {
  const now = opts.now ?? Date.now();
  const ttl = opts.ttlSeconds ?? DEFAULT_CERT_TTL_SECONDS;
  const iat = Math.floor(now / 1000);
  const key = await importJWK(eventPrivateJwk, ALG);
  return await new SignJWT({
    holderName: claims.holderName,
    dniLast2: claims.dniLast2,
    zoneId: claims.zoneId,
    ticketPub: claims.ticketPub,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.ticketId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ttl)
    .sign(key);
}

export async function verifyCert(
  eventPublicJwk: JWK,
  cert: string,
): Promise<TicketCertClaims | null> {
  try {
    const key = await importJWK(eventPublicJwk, ALG);
    const { payload } = await jwtVerify(cert, key, { algorithms: [ALG] });
    if (!payload.sub || !payload.ticketPub) return null;
    return {
      ticketId: payload.sub,
      holderName: (payload.holderName as string | null) ?? null,
      dniLast2: (payload.dniLast2 as string | null) ?? null,
      zoneId: (payload.zoneId as string | null) ?? null,
      ticketPub: payload.ticketPub as JWK,
    };
  } catch {
    return null;
  }
}

// ── Firma de window (ECDSA raw con la privada del ticket, en el device) ──────

const enc = new TextEncoder();

const windowPayload = (ticketId: string, windowIdx: number): Uint8Array =>
  enc.encode(`${ticketId}|${windowIdx}`);

export async function signWindow(
  ticketPrivateKey: CryptoKey,
  ticketId: string,
  windowIdx: number,
): Promise<string> {
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    ticketPrivateKey,
    windowPayload(ticketId, windowIdx) as BufferSource,
  );
  return bytesToB64url(new Uint8Array(sig));
}

export async function verifyWindow(
  ticketPublicJwk: JWK,
  ticketId: string,
  claimedWindow: number,
  sigB64url: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (Math.abs(claimedWindow - currentWindow(now)) > WINDOW_TOLERANCE) {
    return false;
  }
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      ticketPublicJwk as JsonWebKey,
      { name: "ECDSA", namedCurve: CURVE },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      b64urlToBytes(sigB64url) as BufferSource,
      windowPayload(ticketId, claimedWindow) as BufferSource,
    );
  } catch {
    return false;
  }
}

// ── Formato del QR firmado: cert ~ windowIdx ~ sig ───────────────────────────
// Separador "~": el cert es un JWS (contiene puntos) y las firmas son base64url
// (alfabeto A-Za-z0-9-_), ninguno contiene "~".

export const SIGNED_QR_SEP = "~";

export const buildSignedQrPayload = (
  cert: string,
  windowIdx: number,
  sig: string,
): string => `${cert}${SIGNED_QR_SEP}${windowIdx}${SIGNED_QR_SEP}${sig}`;

export const parseSignedQrPayload = (
  raw: string,
): { cert: string; windowIdx: number; sig: string } | null => {
  const parts = raw.split(SIGNED_QR_SEP);
  if (parts.length !== 3) return null;
  const [cert, w, sig] = parts;
  const windowIdx = Number(w);
  if (!cert || !sig || !Number.isFinite(windowIdx) || windowIdx <= 0) {
    return null;
  }
  return { cert, windowIdx, sig };
};

export type SignedQrResult =
  | { valid: true; claims: TicketCertClaims; window: number }
  | { valid: false; reason: "malformed" | "bad_cert" | "bad_window" };

/**
 * Verificación completa offline de un QR firmado contra la pública del evento.
 * No requiere lista de asistentes: el cert porta los datos del titular.
 */
export async function verifySignedQr(
  eventPublicJwk: JWK,
  raw: string,
  now: number = Date.now(),
): Promise<SignedQrResult> {
  const parsed = parseSignedQrPayload(raw);
  if (!parsed) return { valid: false, reason: "malformed" };
  const claims = await verifyCert(eventPublicJwk, parsed.cert);
  if (!claims) return { valid: false, reason: "bad_cert" };
  const okWindow = await verifyWindow(
    claims.ticketPub,
    claims.ticketId,
    parsed.windowIdx,
    parsed.sig,
    now,
  );
  if (!okWindow) return { valid: false, reason: "bad_window" };
  return { valid: true, claims, window: parsed.windowIdx };
}

// ── base64url isomórfico (sin Buffer) ────────────────────────────────────────

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

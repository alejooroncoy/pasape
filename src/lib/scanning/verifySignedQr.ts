import type { JWK } from "jose";
import {
  parseSignedQrPayload,
  verifySignedQr as verifyCore,
  type SignedQrResult,
} from "@/lib/tickets/signedQr";
import { getCachedSigningKey } from "./scanCache";

// Verificación offline del portero: confirma que el QR firmado (cert~window~sig)
// fue emitido por el evento y está fresco, usando la pública del evento cacheada
// en IndexedDB. No requiere lista de asistentes — el cert porta la identidad.

export function isSignedQr(raw: string): boolean {
  return parseSignedQrPayload(raw) !== null;
}

export async function verifySignedScan(
  raw: string,
  now: number = Date.now(),
): Promise<SignedQrResult> {
  const pub = await getCachedSigningKey();
  if (!pub) return { valid: false, reason: "bad_cert" };
  return verifyCore(pub as unknown as JWK, raw, now);
}

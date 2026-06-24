import type { JWK } from "jose";
import {
  isCompactQrPayload,
  parseCompactQrPayload,
  verifyCompactQr,
  parseSignedQrPayload,
  verifySignedQr as verifyCore,
  type SignedQrResult,
} from "@/lib/tickets/signedQr";
import { getCachedSigningKey, lookupTicketById } from "./scanCache";

export function isSignedQr(raw: string): boolean {
  return isCompactQrPayload(raw) || parseSignedQrPayload(raw) !== null;
}

export async function verifySignedScan(
  raw: string,
  now: number = Date.now(),
): Promise<SignedQrResult> {
  // Formato compacto (nuevo): ticketId+windowIdx+sig, sin cert en el QR
  if (isCompactQrPayload(raw)) {
    const parsed = parseCompactQrPayload(raw);
    if (!parsed) return { valid: false, reason: "malformed" };

    const ticket = await lookupTicketById(parsed.ticketId);
    if (!ticket?.signingPub) return { valid: false, reason: "bad_cert" };

    const ok = await verifyCompactQr(
      ticket.signingPub,
      parsed.ticketId,
      parsed.windowIdx,
      parsed.sig,
      now,
    );
    if (!ok) return { valid: false, reason: "bad_window" };

    return {
      valid: true,
      claims: {
        ticketId: parsed.ticketId,
        holderName: ticket.holderName,
        dniLast2: ticket.holderDniLast2,
        zoneId: null,
        ticketPub: ticket.signingPub as JWK,
      },
      window: parsed.windowIdx,
    };
  }

  // Formato legado (cert~window~sig) — compatibilidad durante transición
  const pub = await getCachedSigningKey();
  if (!pub) return { valid: false, reason: "bad_cert" };
  return verifyCore(pub as unknown as JWK, raw, now);
}

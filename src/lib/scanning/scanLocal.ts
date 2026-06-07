import {
  lookupTicket,
  lookupTicketById,
  markUsedLocal,
  markUsedLocalById,
} from "./scanCache";
import { enqueuePendingScan } from "./scanQueue";
import { isSignedQr, verifySignedScan } from "./verifySignedQr";
import { arbitrateTicket } from "./coordination/registry";

export type ScanLocalResult = {
  kind: "valid" | "already_used" | "invalid";
  holderName: string | null;
  holderDniLast2: string | null;
  ticketTypeName: string | null;
  boxLabel: string | null;
  boxHostName: string | null;
  boxFilled: number | null;
  boxCapacity: number | null;
};

const empty = (kind: ScanLocalResult["kind"]): ScanLocalResult => ({
  kind,
  holderName: null,
  holderDniLast2: null,
  ticketTypeName: null,
  boxLabel: null,
  boxHostName: null,
  boxFilled: null,
  boxCapacity: null,
});

export async function scanLocal(qrCode: string): Promise<ScanLocalResult> {
  // QR firmado (ECDSA): verificar por firma, no por lookup del QR estático.
  if (isSignedQr(qrCode)) {
    return scanSignedLocal(qrCode);
  }
  return scanStaticLocal(qrCode);
}

/**
 * Verifica un QR firmado offline (firma del evento + frescura del window) y
 * aplica primer-scan-gana local por ticketId. El cert porta la identidad del
 * titular, así que funciona aunque el ticket no esté en el cache.
 */
async function scanSignedLocal(raw: string): Promise<ScanLocalResult> {
  const res = await verifySignedScan(raw);
  if (!res.valid) {
    // firma inválida, screenshot viejo (window) o sin pública del evento
    return empty("invalid");
  }
  const { ticketId, holderName, dniLast2 } = res.claims;
  const cached = await lookupTicketById(ticketId);

  if (cached?.status === "used") {
    return {
      ...empty("already_used"),
      holderName: cached.holderName,
      holderDniLast2: cached.holderDniLast2,
      ticketTypeName: cached.ticketTypeName,
      boxLabel: cached.boxLabel,
    };
  }

  // Arbitraje entre puertas: si otra puerta de la zona ya tomó este ticket, es
  // un duplicado en vivo. Sin coordinador (BLE caído), concede y detecta al sync.
  if ((await arbitrateTicket(ticketId)) === "denied") {
    return {
      ...empty("already_used"),
      holderName: holderName ?? cached?.holderName ?? null,
      holderDniLast2: dniLast2 ?? cached?.holderDniLast2 ?? null,
      ticketTypeName: cached?.ticketTypeName ?? null,
      boxLabel: cached?.boxLabel ?? null,
    };
  }

  if (cached) await markUsedLocalById(ticketId);
  // Encolamos el qr_code estático cacheado: al sincronizar evita el problema de
  // window viejo (pass-through legacy). Si no está en cache, va el raw firmado.
  await enqueuePendingScan({
    ticketId,
    qrCode: cached?.qrCode ?? raw,
    scannedAt: new Date().toISOString(),
  });
  return {
    ...empty("valid"),
    holderName: holderName ?? cached?.holderName ?? null,
    holderDniLast2: dniLast2 ?? cached?.holderDniLast2 ?? null,
    ticketTypeName: cached?.ticketTypeName ?? null,
    boxLabel: cached?.boxLabel ?? null,
  };
}

/** QR estático legacy: lookup directo en el cache por qrCode. */
async function scanStaticLocal(qrCode: string): Promise<ScanLocalResult> {
  const t = await lookupTicket(qrCode);
  if (!t) return empty("invalid");
  if (t.status === "used") {
    return {
      ...empty("already_used"),
      holderName: t.holderName,
      holderDniLast2: t.holderDniLast2,
      ticketTypeName: t.ticketTypeName,
      boxLabel: t.boxLabel,
    };
  }
  if ((await arbitrateTicket(t.ticketId)) === "denied") {
    return {
      ...empty("already_used"),
      holderName: t.holderName,
      holderDniLast2: t.holderDniLast2,
      ticketTypeName: t.ticketTypeName,
      boxLabel: t.boxLabel,
    };
  }
  await markUsedLocal(qrCode);
  await enqueuePendingScan({
    ticketId: t.ticketId,
    qrCode,
    scannedAt: new Date().toISOString(),
  });
  return {
    ...empty("valid"),
    holderName: t.holderName,
    holderDniLast2: t.holderDniLast2,
    ticketTypeName: t.ticketTypeName,
    boxLabel: t.boxLabel,
  };
}

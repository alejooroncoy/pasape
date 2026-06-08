import { lookupTicketById, markUsedLocalById } from "./scanCache";
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

/**
 * Escaneo de cámara offline: SOLO QR firmado (ECDSA). No hay fallback a QR
 * estático — un screenshot de un QR estático ya no valida. Verifica firma del
 * evento + frescura del window, luego aplica primer-scan-gana local.
 */
export async function scanLocal(qrCode: string): Promise<ScanLocalResult> {
  if (!isSignedQr(qrCode)) return empty("invalid");
  const res = await verifySignedScan(qrCode);
  if (!res.valid) return empty("invalid");
  const { ticketId, holderName, dniLast2 } = res.claims;
  return admitResolved(ticketId, qrCode, "signed", { holderName, dniLast2 });
}

/**
 * Admisión manual offline desde la lista (búsqueda por nombre/DNI). Confiable
 * por ticketId: el portero admite deliberadamente, no hay QR que verificar.
 */
export async function admitLocal(ticketId: string): Promise<ScanLocalResult> {
  return admitResolved(ticketId, "", "manual", {});
}

async function admitResolved(
  ticketId: string,
  token: string,
  kind: "signed" | "manual",
  override: { holderName?: string | null; dniLast2?: string | null },
): Promise<ScanLocalResult> {
  const cached = await lookupTicketById(ticketId);

  const usedResult = (): ScanLocalResult => ({
    ...empty("already_used"),
    holderName: override.holderName ?? cached?.holderName ?? null,
    holderDniLast2: override.dniLast2 ?? cached?.holderDniLast2 ?? null,
    ticketTypeName: cached?.ticketTypeName ?? null,
    boxLabel: cached?.boxLabel ?? null,
  });

  if (cached?.status === "used") return usedResult();

  // Arbitraje entre puertas: si otra puerta de la zona ya tomó este ticket, es
  // un duplicado en vivo. Sin coordinador (BLE caído), concede y detecta al sync.
  if ((await arbitrateTicket(ticketId)) === "denied") return usedResult();

  if (cached) await markUsedLocalById(ticketId);
  await enqueuePendingScan({
    ticketId,
    token,
    kind,
    scannedAt: new Date().toISOString(),
  });
  return {
    ...empty("valid"),
    holderName: override.holderName ?? cached?.holderName ?? null,
    holderDniLast2: override.dniLast2 ?? cached?.holderDniLast2 ?? null,
    ticketTypeName: cached?.ticketTypeName ?? null,
    boxLabel: cached?.boxLabel ?? null,
  };
}

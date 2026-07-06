import { lookupTicketById, markUsedLocalById, getBoxFill, getZonePolicy, isTicketAllowedInZone } from "./scanCache";
import { enqueuePendingScan } from "./scanQueue";
import { isSignedQr, verifySignedScan } from "./verifySignedQr";
import { arbitrateTicket } from "./coordination/registry";

export type ScanLocalResult = {
  kind: "valid" | "already_used" | "invalid";
  holderName: string | null;
  holderDniLast4: string | null;
  ticketTypeName: string | null;
  boxLabel: string | null;
  boxHostName: string | null;
  boxFilled: number | null;
  boxCapacity: number | null;
  /**
   * Motivo del rechazo cuando `kind === "invalid"` — para diagnóstico en device
   * (visible en `adb logcat`). No se muestra al portero (la UI solo dice "QR
   * inválido"), pero permite distinguir cache desactualizado (bad_cert) de clock
   * skew (bad_window) o formato no firmado (unrecognized/malformed).
   */
  reason: "unrecognized" | "malformed" | "bad_cert" | "bad_window" | "wrong_zone" | null;
};

const empty = (
  kind: ScanLocalResult["kind"],
  reason: ScanLocalResult["reason"] = null,
): ScanLocalResult => ({
  kind,
  holderName: null,
  holderDniLast4: null,
  ticketTypeName: null,
  boxLabel: null,
  boxHostName: null,
  boxFilled: null,
  boxCapacity: null,
  reason,
});

/**
 * Escaneo de cámara offline: SOLO QR firmado (ECDSA). No hay fallback a QR
 * estático — un screenshot de un QR estático ya no valida. Verifica firma del
 * evento + frescura del window, luego aplica primer-scan-gana local.
 */
export async function scanLocal(qrCode: string): Promise<ScanLocalResult> {
  if (!isSignedQr(qrCode)) {
    console.warn(
      `[scan] QR no firmado (no reconocido). len=${qrCode.length} preview=${qrCode.slice(0, 24)}…`,
    );
    return empty("invalid", "unrecognized");
  }
  const res = await verifySignedScan(qrCode);
  if (!res.valid) {
    console.warn(`[scan] QR inválido offline: reason=${res.reason}`);
    return empty("invalid", res.reason);
  }
  const { ticketId, holderName } = res.claims;
  return admitResolved(ticketId, qrCode, "signed", { holderName });
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
  override: { holderName?: string | null },
): Promise<ScanLocalResult> {
  const cached = await lookupTicketById(ticketId);
  const zonePolicy = await getZonePolicy();
  if (zonePolicy?.enforce && !isTicketAllowedInZone(cached?.ticketTypeId, zonePolicy)) {
    console.warn(`[scan] ticket ${ticketId} tipo ${cached?.ticketTypeId ?? "?"} fuera de zona`);
    return empty("invalid", "wrong_zone");
  }

  const usedResult = (): ScanLocalResult => ({
    ...empty("already_used"),
    holderName: override.holderName ?? cached?.holderName ?? null,
    holderDniLast4: cached?.holderDniLast4 ?? null,
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
  // Aforo del box desde el cache (tras marcar usado, para que el conteo incluya
  // este ingreso). null si no es box.
  const box = cached?.boxLabel ? await getBoxFill(ticketId) : null;
  return {
    ...empty("valid"),
    holderName: override.holderName ?? cached?.holderName ?? null,
    holderDniLast4: cached?.holderDniLast4 ?? null,
    ticketTypeName: cached?.ticketTypeName ?? null,
    boxLabel: cached?.boxLabel ?? null,
    boxFilled: box?.filled ?? null,
    boxCapacity: box?.capacity ?? null,
  };
}

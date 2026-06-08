import type { ClaimCoordinator } from "./ClaimCoordinator";

// Coordinador activo de la zona (si el enlace BLE está levantado). scanLocal lo
// consulta para arbitrar dobles ingresos en vivo. Si es null, se degrada limpio:
// se valida igual y el duplicado se detecta al sincronizar (flag dup_offline).

let active: ClaimCoordinator | null = null;

export function setActiveCoordinator(c: ClaimCoordinator | null): void {
  active = c;
}

export function getActiveCoordinator(): ClaimCoordinator | null {
  return active;
}

/** Arbitra un ticket con el coordinador activo; concede si no hay coordinador. */
export async function arbitrateTicket(
  ticketId: string,
): Promise<"granted" | "denied"> {
  const c = active;
  if (!c) return "granted";
  try {
    return await c.claim(ticketId);
  } catch {
    return "granted"; // BLE falló a mitad → degrada (detección al sync)
  }
}

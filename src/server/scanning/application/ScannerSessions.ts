import { supabaseAdmin } from "@/server/_shared/supabase/admin";

export type ScannerSession = {
  id: string;
  eventId: string;
  zoneId: string | null;
  deviceId: string;
  expiresAt: string;
};

/**
 * Devuelve la sesión de portero activa (no expirada, no revocada) para el
 * (evento, profile) dado. Si se pasa deviceId, exige que coincida (device
 * binding). Sin deviceId, devuelve cualquier sesión activa del profile.
 */
export async function getActiveScannerSession(
  eventId: string,
  profileId: string,
  deviceId?: string,
): Promise<ScannerSession | null> {
  const db = supabaseAdmin();
  let q = db
    .from("scanner_sessions")
    .select("id, event_id, zone_id, device_id, expires_at")
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .eq("revoked", false)
    .gt("expires_at", new Date().toISOString());
  if (deviceId) q = q.eq("device_id", deviceId);

  const { data } = await q
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      event_id: string;
      zone_id: string | null;
      device_id: string;
      expires_at: string;
    }>();
  if (!data) return null;
  return {
    id: data.id,
    eventId: data.event_id,
    zoneId: data.zone_id,
    deviceId: data.device_id,
    expiresAt: data.expires_at,
  };
}

/**
 * Longitud del token opaco de portero: dos UUID v4 en hex sin guiones (32 + 32).
 * Ver `newDoorToken`.
 */
export const DOOR_TOKEN_LENGTH = 64;

/** Solo hex en minúscula, longitud exacta: lo que emite `newDoorToken`. */
const DOOR_TOKEN_RE = new RegExp(`^[0-9a-f]{${DOOR_TOKEN_LENGTH}}$`);

/**
 * Verifica que un token tenga la forma que emite `newDoorToken`. Las sesiones se
 * crean server-side con service-role (JoinByCode); un token bien formado que
 * existe en la tabla solo pudo nacer de un canje de código válido. Rechazar
 * tokens mal formados evita gastar una consulta con basura del cliente.
 */
export function isWellFormedDoorToken(token: string): boolean {
  return DOOR_TOKEN_RE.test(token);
}

/**
 * Resuelve la sesión de portero por su token opaco (auth por código, sin cuenta).
 * Devuelve null si el token está mal formado, no existe, está revocada o expiró.
 */
export async function getSessionByToken(
  token: string,
): Promise<(ScannerSession & { eventId: string }) | null> {
  if (!isWellFormedDoorToken(token)) return null;
  const db = supabaseAdmin();
  const { data } = await db
    .from("scanner_sessions")
    .select("id, event_id, zone_id, device_id, expires_at")
    .eq("token", token)
    .eq("revoked", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<{
      id: string;
      event_id: string;
      zone_id: string | null;
      device_id: string;
      expires_at: string;
    }>();
  if (!data) return null;
  return {
    id: data.id,
    eventId: data.event_id,
    zoneId: data.zone_id,
    deviceId: data.device_id,
    expiresAt: data.expires_at,
  };
}

/** Token opaco de portero (~256 bits). Credencial que la app guarda y manda. */
export function newDoorToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
  );
}

/** Marca el último sync de la sesión (alimenta el banner de honestidad). */
export async function touchScannerSync(sessionId: string): Promise<void> {
  const db = supabaseAdmin();
  await db
    .from("scanner_sessions")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", sessionId);
}

/**
 * Cambia la puerta activa del portero (v1: la elige él mismo y puede cambiarla
 * cuando quiera). `zoneId` null = puerta principal (valida todas). Valida que la
 * zona pertenezca al evento de la sesión antes de asignarla.
 */
export async function setSessionZone(
  sessionId: string,
  eventId: string,
  zoneId: string | null,
): Promise<boolean> {
  const db = supabaseAdmin();
  if (zoneId) {
    const { data } = await db
      .from("zones")
      .select("id")
      .eq("id", zoneId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (!data) return false; // zona ajena al evento
  }
  await db.from("scanner_sessions").update({ zone_id: zoneId }).eq("id", sessionId);
  return true;
}

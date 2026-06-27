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
 * Resuelve la sesión de portero por su token opaco (auth por código, sin cuenta).
 * Devuelve null si no existe, está revocada o expiró.
 */
export async function getSessionByToken(
  token: string,
): Promise<(ScannerSession & { eventId: string }) | null> {
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

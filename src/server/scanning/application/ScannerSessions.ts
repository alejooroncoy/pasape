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

/** Marca el último sync de la sesión (alimenta el banner de honestidad). */
export async function touchScannerSync(sessionId: string): Promise<void> {
  const db = supabaseAdmin();
  await db
    .from("scanner_sessions")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", sessionId);
}

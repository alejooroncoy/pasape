import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { newDoorToken } from "./ScannerSessions";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type JoinResult = {
  /** Credencial opaca del portero. La app la guarda y la manda en cada request. */
  token: string;
  eventSlug: string;
  eventId: string;
  zoneId: string | null;
  expiresAt: string;
};

/**
 * Onboarding de portero por CÓDIGO (sin cuenta): canjea el código del evento +
 * nombre/DNI y crea/extiende una sesión ligada al device (24h), devolviendo un
 * token opaco. No requiere login. Idempotente por (evento, device): re-canjear
 * en el mismo dispositivo reusa la sesión (y su token) y extiende el binding.
 */
export async function joinByCode(input: {
  code: string;
  deviceId: string;
  fullName?: string | null;
  /** DNI completo del portero (identificación). Se guarda server-side; el
   *  display usa solo dni_last2. */
  dni?: string | null;
}): Promise<Result<JoinResult>> {
  const code = input.code.trim();
  const deviceId = input.deviceId.trim();
  if (!code || !deviceId) return err("invalid_input");

  const dni = input.dni?.replace(/\D/g, "") || null;
  const dniLast2 = dni ? dni.slice(-2) : null;

  const db = supabaseAdmin();
  const { data: codeRow } = await db
    .from("event_access_codes")
    .select("event_id, zone_id")
    .eq("code", code)
    .maybeSingle<{ event_id: string; zone_id: string | null }>();
  if (!codeRow) return err("invalid_code");

  const { data: ev } = await db
    .from("events")
    .select("slug")
    .eq("id", codeRow.event_id)
    .maybeSingle<{ slug: string }>();
  if (!ev) return err("event_not_found");

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const now = new Date().toISOString();

  // Reusar la sesión código-solo del mismo (evento, device) si ya existe.
  const { data: existing } = await db
    .from("scanner_sessions")
    .select("id, token")
    .eq("event_id", codeRow.event_id)
    .eq("device_id", deviceId)
    .is("profile_id", null)
    .maybeSingle<{ id: string; token: string | null }>();

  let token = existing?.token ?? null;

  if (existing) {
    const { error: upErr } = await db
      .from("scanner_sessions")
      .update({
        expires_at: expiresAt,
        revoked: false,
        zone_id: codeRow.zone_id,
        holder_name: input.fullName ?? null,
        holder_dni: dni,
        dni_last2: dniLast2,
        last_sync_at: now,
      })
      .eq("id", existing.id);
    if (upErr) return err("session_create_failed");
  } else {
    token = newDoorToken();
    const { error: insErr } = await db.from("scanner_sessions").insert({
      event_id: codeRow.event_id,
      profile_id: null,
      device_id: deviceId,
      zone_id: codeRow.zone_id,
      token,
      holder_name: input.fullName ?? null,
      holder_dni: dni,
      dni_last2: dniLast2,
      expires_at: expiresAt,
      revoked: false,
      last_sync_at: now,
    });
    if (insErr) return err("session_create_failed");
  }

  if (!token) return err("session_create_failed");

  return ok({
    token,
    eventSlug: ev.slug,
    eventId: codeRow.event_id,
    zoneId: codeRow.zone_id,
    expiresAt,
  });
}

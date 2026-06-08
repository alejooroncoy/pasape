import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type JoinResult = {
  eventSlug: string;
  eventId: string;
  zoneId: string | null;
  expiresAt: string;
};

/**
 * Onboarding de portero: canjea un código de evento y crea/extiende su sesión
 * ligada al device (binding 24h). El portero no necesita ser miembro de la org.
 * Idempotente por (evento, profile, device): re-canjear extiende la sesión.
 */
export async function joinByCode(input: {
  code: string;
  deviceId: string;
  fullName?: string | null;
  dniLast2?: string | null;
}): Promise<Result<JoinResult>> {
  const auth = await getAuthContext();
  if (!auth.ok) return err("unauthorized");

  const code = input.code.trim();
  const deviceId = input.deviceId.trim();
  if (!code || !deviceId) return err("invalid_input");

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
  const { error: upErr } = await db.from("scanner_sessions").upsert(
    {
      event_id: codeRow.event_id,
      profile_id: auth.value.profileId,
      device_id: deviceId,
      zone_id: codeRow.zone_id,
      expires_at: expiresAt,
      revoked: false,
      last_sync_at: new Date().toISOString(),
    },
    { onConflict: "event_id,profile_id,device_id" },
  );
  if (upErr) return err("session_create_failed");

  // Capturamos nombre/DNI del portero en su perfil si los proporcionó (capa
  // humana en puerta: el portero identificado).
  if (input.fullName || input.dniLast2) {
    const patch: Record<string, string> = {};
    if (input.fullName) patch.full_name = input.fullName;
    if (Object.keys(patch).length > 0) {
      await db.from("profiles").update(patch).eq("id", auth.value.profileId);
    }
  }

  return ok({
    eventSlug: ev.slug,
    eventId: codeRow.event_id,
    zoneId: codeRow.zone_id,
    expiresAt,
  });
}

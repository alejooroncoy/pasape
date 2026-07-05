import { headers } from "next/headers";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getEventBySlug } from "@/server/events/application/GetEventBySlug";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { getSessionByToken } from "./ScannerSessions";

export const SCANNER_DEVICE_HEADER = "x-scanner-device";
export const SCANNER_TOKEN_HEADER = "x-door-token";

export type ScanAccessContext = {
  /** profile del organizador (membership). null para el portero por código. */
  profileId: string | null;
  eventId: string;
  organizationId: string;
  /** "membership" = admin/org; "session" = portero por código + token. */
  via: "membership" | "session";
  zoneId: string | null;
  sessionId: string | null;
};

/**
 * Verifica que quien llama puede escanear tickets del evento. Dos caminos:
 *   - Portero por CÓDIGO (app): header x-door-token → sesión por token, sin
 *     cookies ni cuenta. Es el camino principal del Modo Puerta.
 *   - Miembro de la org (dashboard web): cookie de sesión + membership.
 *
 * Usado por ScanningController, getScanCache y /attendees.
 */
export async function verifyScanAccess(
  eventSlug: string,
  opts: { deviceId?: string; doorToken?: string } = {},
): Promise<Result<ScanAccessContext>> {
  const detail = await getEventBySlug({ repo }, eventSlug);
  if (!detail) return err("event_not_found");

  // Camino portero por código: token opaco, sin login.
  const hdrs = await headers();
  const token = opts.doorToken ?? hdrs.get(SCANNER_TOKEN_HEADER) ?? undefined;
  if (token) {
    const session = await getSessionByToken(token);
    if (!session || session.eventId !== detail.event.id) return err("forbidden");
    // Device binding (LOW-7): el token opaco por sí solo NO debe autenticar
    // desde cualquier dispositivo. Si el caller manda un deviceId (body o
    // header x-scanner-device), debe coincidir con el device con el que se
    // creó la sesión — si no, el token filtrado no sirve desde otro device.
    const callerDeviceId = opts.deviceId ?? hdrs.get(SCANNER_DEVICE_HEADER) ?? undefined;
    if (callerDeviceId && callerDeviceId !== session.deviceId) return err("forbidden");
    return ok({
      profileId: null,
      eventId: detail.event.id,
      organizationId: detail.event.organizationId,
      via: "session",
      zoneId: session.zoneId,
      sessionId: session.id,
    });
  }

  // Camino organizador: cookie + membership de la org del evento.
  const auth = await getAuthContext();
  if (!auth.ok) return err("unauthorized");

  const db = supabaseAdmin();
  const { data: membership } = await db
    .from("memberships")
    .select("role")
    .eq("scope_type", "organization")
    .eq("scope_id", detail.event.organizationId)
    .eq("profile_id", auth.value.profileId)
    .maybeSingle<{ role: string }>();

  if (membership) {
    return ok({
      profileId: auth.value.profileId,
      eventId: detail.event.id,
      organizationId: detail.event.organizationId,
      via: "membership",
      zoneId: null,
      sessionId: null,
    });
  }

  return err("forbidden");
}

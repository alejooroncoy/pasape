import { headers } from "next/headers";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getEventBySlug } from "@/server/events/application/GetEventBySlug";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { getActiveScannerSession } from "./ScannerSessions";

export const SCANNER_DEVICE_HEADER = "x-scanner-device";

export type ScanAccessContext = {
  profileId: string;
  eventId: string;
  organizationId: string;
  /** "membership" = admin/org; "session" = portero con código + binding 24h. */
  via: "membership" | "session";
  zoneId: string | null;
  sessionId: string | null;
};

/**
 * Verifica que el usuario autenticado puede escanear tickets del evento.
 * Acepta DOS caminos:
 *   - Miembro de la org del evento (admins, dashboard) — sin device binding.
 *   - Portero con sesión activa (código + binding 24h en scanner_sessions).
 * El deviceId se lee del header x-scanner-device (o del parámetro).
 *
 * Usado por:
 *   - ScanningController.scan()       → antes de validar el QR
 *   - EventsController.getScanCache() → antes de servir el cache offline
 *   - /api/events/[slug]/attendees    → antes de mostrar la lista
 */
export async function verifyScanAccess(
  eventSlug: string,
  opts: { deviceId?: string } = {},
): Promise<Result<ScanAccessContext>> {
  const auth = await getAuthContext();
  if (!auth.ok) return err("unauthorized");

  const detail = await getEventBySlug({ repo }, eventSlug);
  if (!detail) return err("event_not_found");

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

  // Sin membership: ¿tiene sesión de portero activa?
  const deviceId =
    opts.deviceId ?? (await headers()).get(SCANNER_DEVICE_HEADER) ?? undefined;
  const session = await getActiveScannerSession(
    detail.event.id,
    auth.value.profileId,
    deviceId,
  );
  if (!session) return err("forbidden");

  return ok({
    profileId: auth.value.profileId,
    eventId: detail.event.id,
    organizationId: detail.event.organizationId,
    via: "session",
    zoneId: session.zoneId,
    sessionId: session.id,
  });
}

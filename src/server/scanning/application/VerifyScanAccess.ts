import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getEventBySlug } from "@/server/events/application/GetEventBySlug";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";

export type ScanAccessContext = {
  profileId: string;
  eventId: string;
  organizationId: string;
};

/**
 * Verifica que el usuario autenticado tiene derecho a escanear tickets
 * del evento indicado. Requiere ser miembro del org del evento.
 *
 * Usado por:
 *   - ScanningController.scan()       → antes de validar el QR
 *   - EventsController.getScanCache() → antes de servir el cache offline
 *   - /api/events/[slug]/attendees    → antes de mostrar la lista
 */
export async function verifyScanAccess(
  eventSlug: string,
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

  if (!membership) return err("forbidden");

  return ok({
    profileId: auth.value.profileId,
    eventId: detail.event.id,
    organizationId: detail.event.organizationId,
  });
}

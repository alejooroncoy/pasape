import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";

/**
 * Persona invitada como co-organizadora puntual de un evento.
 * NO confundir con membresías de la marca/razón social (memberships): esas viven en
 * la BC `identity/organizations` y dan acceso transversal. Los co-org de evento
 * solo aplican a un slug.
 */
export type EventCoOrganizer = {
  profileId: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  addedAt: string;
};

/**
 * Lista los co-organizadores asignados solo a este evento (tabla
 * `event_co_organizers`). No incluye gente con acceso heredado desde la marca,
 * razón social o portafolio.
 */
export const listEventCoOrganizers = async (
  eventId: string,
): Promise<EventCoOrganizer[]> => {
  const db = supabaseAdmin();
  const { data } = await db
    .from("event_co_organizers")
    .select(
      "profile_id, created_at, profiles:profiles!inner(id, full_name, email, avatar_url)",
    )
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (!data) return [];
  type Row = {
    profile_id: string;
    created_at: string;
    profiles: {
      id: string;
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
    };
  };
  return (data as unknown as Row[]).map((r) => ({
    profileId: r.profile_id,
    fullName: r.profiles.full_name,
    email: r.profiles.email,
    avatarUrl: r.profiles.avatar_url,
    addedAt: r.created_at,
  }));
};

export const addEventCoOrganizer = async (
  eventId: string,
  profileId: string,
): Promise<Result<{ profileId: string }>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("event_co_organizers")
    .upsert({ event_id: eventId, profile_id: profileId }, { onConflict: "event_id,profile_id" });
  if (error) return err(error.message);
  return ok({ profileId });
};

export const removeEventCoOrganizer = async (
  eventId: string,
  profileId: string,
): Promise<Result<{ profileId: string }>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("event_co_organizers")
    .delete()
    .eq("event_id", eventId)
    .eq("profile_id", profileId);
  if (error) return err(error.message);
  return ok({ profileId });
};

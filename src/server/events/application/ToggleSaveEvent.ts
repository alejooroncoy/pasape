import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";

/** Guarda un evento (idempotente: si ya estaba guardado, no falla). */
export const saveEvent = async (
  profileId: string,
  eventId: string,
): Promise<Result<{ saved: true }>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("saved_events")
    .upsert(
      { user_id: profileId, event_id: eventId },
      { onConflict: "user_id,event_id", ignoreDuplicates: true },
    );
  if (error) return err(error.message);
  return ok({ saved: true });
};

/** Quita un evento de guardados (idempotente). */
export const unsaveEvent = async (
  profileId: string,
  eventId: string,
): Promise<Result<{ saved: false }>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("saved_events")
    .delete()
    .eq("user_id", profileId)
    .eq("event_id", eventId);
  if (error) return err(error.message);
  return ok({ saved: false });
};

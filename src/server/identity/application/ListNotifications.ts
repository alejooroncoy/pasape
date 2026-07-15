import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";

export type Notification = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export const listNotifications = async (profileId: string): Promise<Result<Notification[]>> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("notifications")
    .select("id, kind, payload, read_at, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return err(error.message);
  return ok(
    (data ?? []).map((r) => ({
      id: r.id as string,
      kind: r.kind as string,
      payload: (r.payload ?? {}) as Record<string, unknown>,
      readAt: r.read_at as string | null,
      createdAt: r.created_at as string,
    })),
  );
};

export const countUnreadNotifications = async (
  profileId: string,
  kind: string,
): Promise<Result<number>> => {
  const db = supabaseAdmin();
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("kind", kind)
    .is("read_at", null);
  if (error) return err(error.message);
  return ok(count ?? 0);
};

export const markNotificationsRead = async (
  profileId: string,
  kind: string,
): Promise<Result<{ marked: true }>> => {
  const db = supabaseAdmin();
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("kind", kind)
    .is("read_at", null);
  if (error) return err(error.message);
  return ok({ marked: true });
};

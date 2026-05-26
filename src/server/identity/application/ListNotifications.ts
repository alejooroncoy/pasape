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

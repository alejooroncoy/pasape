import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { EventCategory, EventStatus } from "@/server/events/domain/Event";

export type SavedEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  venue: string | null;
  coverUrl: string | null;
  category: EventCategory | null;
  status: EventStatus;
  savedAt: string;
};

type Row = {
  created_at: string;
  events: {
    id: string;
    slug: string;
    title: string;
    starts_at: string;
    venue: string | null;
    cover_url: string | null;
    category: EventCategory | null;
    status: EventStatus;
  } | null;
};

export const listSavedEvents = async (profileId: string): Promise<Result<SavedEvent[]>> => {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("saved_events")
    .select(
      "created_at, events:event_id(id, slug, title, starts_at, venue, cover_url, category, status)",
    )
    .eq("user_id", profileId)
    .order("created_at", { ascending: false });
  if (error) return err(error.message);
  const rows = (data ?? []) as unknown as Row[];
  return ok(
    rows
      .filter((r) => r.events !== null)
      .map((r) => ({
        id: r.events!.id,
        slug: r.events!.slug,
        title: r.events!.title,
        startsAt: r.events!.starts_at,
        venue: r.events!.venue,
        coverUrl: r.events!.cover_url,
        category: r.events!.category,
        status: r.events!.status,
        savedAt: r.created_at,
      })),
  );
};

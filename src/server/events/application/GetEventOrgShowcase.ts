import { supabaseAdmin } from "@/server/_shared/supabase/admin";

export type ShowcaseOrg = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
};

export type ShowcaseEvent = {
  slug: string;
  title: string;
  coverUrl: string | null;
  startsAt: string;
  venue: string | null;
  minPriceCents: number | null;
};

export type EventOrgShowcase = {
  org: ShowcaseOrg;
  events: ShowcaseEvent[];
};

/**
 * Dado el slug de un evento, devuelve su productora (mini-perfil) y los OTROS
 * eventos próximos de esa misma marca — el cross-sell estilo Passline/Luma.
 * Devuelve null si el evento o la org no existen.
 */
export const getEventOrgShowcase = async (
  eventSlug: string,
): Promise<EventOrgShowcase | null> => {
  const db = supabaseAdmin();

  const { data: ev } = await db
    .from("events")
    .select("id, organization_id")
    .eq("slug", eventSlug)
    .maybeSingle<{ id: string; organization_id: string }>();
  if (!ev) return null;

  const { data: org } = await db
    .from("organizations")
    .select("id, slug, name, logo_url, brand_color")
    .eq("id", ev.organization_id)
    .maybeSingle<{
      id: string;
      slug: string;
      name: string;
      logo_url: string | null;
      brand_color: string | null;
    }>();
  if (!org) return null;

  const cutoff = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data: rawEvents } = await db
    .from("events")
    .select("id, slug, title, cover_url, starts_at, venue")
    .eq("organization_id", org.id)
    .eq("status", "published")
    .neq("id", ev.id)
    .gte("starts_at", cutoff)
    .order("starts_at", { ascending: true })
    .limit(6);

  type Row = {
    id: string;
    slug: string;
    title: string;
    cover_url: string | null;
    starts_at: string;
    venue: string | null;
  };
  const rows = (rawEvents as Row[] | null) ?? [];

  // Precio mínimo por evento (una sola consulta).
  let minByEvent: Record<string, number> = {};
  if (rows.length > 0) {
    const { data: tts } = await db
      .from("ticket_types")
      .select("event_id, price_cents")
      .in(
        "event_id",
        rows.map((r) => r.id),
      );
    for (const t of (tts as Array<{ event_id: string; price_cents: number }> | null) ?? []) {
      const prev = minByEvent[t.event_id];
      if (prev == null || t.price_cents < prev) minByEvent[t.event_id] = t.price_cents;
    }
  }

  return {
    org: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      logoUrl: org.logo_url,
      brandColor: org.brand_color,
    },
    events: rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      coverUrl: r.cover_url,
      startsAt: r.starts_at,
      venue: r.venue,
      minPriceCents: minByEvent[r.id] ?? null,
    })),
  };
};

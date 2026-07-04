import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { buyerUnitPriceCents } from "@/lib/tickets/serviceFee";
import type { FeeMode } from "@/server/events/domain/Event";
import { supabaseLegalEntityRepository } from "../infrastructure/repositories/SupabaseLegalEntityRepository";
import type { LegalEntity } from "../domain/LegalEntity";

export type PublicHubBrand = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  upcomingCount: number;
};

export type PublicHubEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  venue: string | null;
  coverUrl: string | null;
  orgId: string;
  orgSlug: string;
  orgName: string;
  minPriceCents: number | null;
};

export type PublicHub = {
  entity: LegalEntity;
  brands: PublicHubBrand[];
  events: PublicHubEvent[];
};

export const getLegalEntityPublicHub = async (slug: string): Promise<PublicHub | null> => {
  const entity = await supabaseLegalEntityRepository.findBySlug(slug);
  if (!entity) return null;

  const db = supabaseAdmin();
  const { data: orgs } = await db
    .from("organizations")
    .select("id, slug, name, logo_url, brand_color")
    .eq("legal_entity_id", entity.id)
    .order("name", { ascending: true });

  type OrgRow = {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    brand_color: string | null;
  };
  const orgRows = (orgs as OrgRow[] | null) ?? [];
  if (orgRows.length === 0) {
    return { entity, brands: [], events: [] };
  }

  const orgIds = orgRows.map((o) => o.id);
  const cutoff = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

  const { data: rawEvents } = await db
    .from("events")
    .select("id, slug, title, starts_at, venue, cover_url, organization_id, fee_mode")
    .in("organization_id", orgIds)
    .eq("status", "published")
    .gte("starts_at", cutoff)
    .order("starts_at", { ascending: true });

  type EventRow = {
    id: string;
    slug: string;
    title: string;
    starts_at: string;
    venue: string | null;
    cover_url: string | null;
    organization_id: string;
    fee_mode: FeeMode;
  };
  const events = (rawEvents as EventRow[] | null) ?? [];
  const feeModeByEvent = new Map(events.map((e) => [e.id, e.fee_mode]));

  // Min price per event (single query for everything). Precio "todo incluido"
  // que ve el comprador (comisión ya aplicada), misma fuente que la buy page y
  // el detalle — nunca se muestra el precio de cara.
  const minPriceByEvent: Record<string, number> = {};
  if (events.length > 0) {
    const { data: tts } = await db
      .from("ticket_types")
      .select("event_id, price_cents")
      .in(
        "event_id",
        events.map((e) => e.id),
      );
    for (const row of (tts as Array<{ event_id: string; price_cents: number }> | null) ?? []) {
      const price = buyerUnitPriceCents(row.price_cents, feeModeByEvent.get(row.event_id) ?? "buyer_pays_extra");
      const prev = minPriceByEvent[row.event_id];
      if (prev == null || price < prev) {
        minPriceByEvent[row.event_id] = price;
      }
    }
  }

  const upcomingByOrg = new Map<string, number>();
  for (const e of events) {
    upcomingByOrg.set(e.organization_id, (upcomingByOrg.get(e.organization_id) ?? 0) + 1);
  }

  const brands: PublicHubBrand[] = orgRows.map((o) => ({
    id: o.id,
    slug: o.slug,
    name: o.name,
    logoUrl: o.logo_url,
    brandColor: o.brand_color,
    upcomingCount: upcomingByOrg.get(o.id) ?? 0,
  }));

  const orgById = new Map(orgRows.map((o) => [o.id, o]));
  const publicEvents: PublicHubEvent[] = events.map((e) => {
    const o = orgById.get(e.organization_id);
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      startsAt: e.starts_at,
      venue: e.venue,
      coverUrl: e.cover_url,
      orgId: e.organization_id,
      orgSlug: o?.slug ?? "",
      orgName: o?.name ?? "",
      minPriceCents: minPriceByEvent[e.id] ?? null,
    };
  });

  return { entity, brands, events: publicEvents };
};

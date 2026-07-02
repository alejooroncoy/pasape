import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import { decryptDni } from "@/server/_shared/crypto/dni";
import type {
  AttendeeRow,
  CreateEventInput,
  CreateTicketTypeInput,
  EventPromoterScheme,
  EventRepository,
  EventStats,
  PromoInput,
  PromoterReportRow,
  ScanFeedItem,
  UpdateEventInput,
  UpdateTicketTypeInput,
} from "@/server/events/ports/EventRepository";
import type { Event, EventCategory, Promo, PresaleTier, TicketType } from "@/server/events/domain/Event";
import {
  computePromoterPayout,
  resolveCommissionScheme,
} from "@/server/promoters/application/CommissionResolver";
import type {
  CommissionConfig,
  CommissionType,
} from "@/server/promoters/domain/OrgPromoter";

type EventRow = {
  id: string;
  slug: string;
  organization_id: string;
  created_by: string;
  title: string;
  description: string | null;
  venue: string | null;
  venue_lat: number | string | null;
  venue_lng: number | string | null;
  venue_url: string | null;
  venue_source: "manual" | "google" | "apple" | null;
  venue_layout_url: string | null;
  cover_url: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  status: Event["status"];
  category: EventCategory | null;
  currency: string;
  total_capacity: number | null;
  overbook_pct: number;
  transfers_enabled: boolean;
  transfer_deadline_hours: number | null;
  transfer_max_count: number;
  transfer_requires_kyc: boolean;
  version: number;
  created_at: string;
};

type TicketTypeRow = {
  id: string;
  event_id: string;
  name: string;
  kind: TicketType["kind"];
  price_cents: number;
  currency: string;
  capacity: number;
  sold: number;
  position: number;
  box_label: string | null;
  unit_noun: string | null;
  sale_ends_at: string | null;
  presale_price_cents: number | null;
  presale_qty: number | null;
  presale_ends_at: string | null;
  description: string | null;
  is_free: boolean;
  free_until_at: string | null;
};

type PromoRow = {
  id: string;
  event_id: string;
  ticket_type_id: string;
  kind: Promo["kind"];
  ends_at: string | null;
};

type PresaleTierRow = {
  id: string;
  ticket_type_id: string;
  price_cents: number;
  ends_at: string;
  position: number;
};

const computeSaleStatus = (
  r: TicketTypeRow,
  now: Date,
): "available" | "expired" | "soldout" => {
  if (r.sale_ends_at && new Date(r.sale_ends_at) < now) return "expired";
  if (r.kind === "box") return r.sold > 0 ? "soldout" : "available";
  return r.capacity - r.sold > 0 ? "available" : "soldout";
};

/** Devuelve el tramo de preventa activo (el más próximo a vencer que aún no venció). */
const activePresaleTier = (tiers: PresaleTierRow[], now: Date): PresaleTierRow | null => {
  const sorted = [...tiers].sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());
  return sorted.find(t => new Date(t.ends_at) > now) ?? null;
};

const toPromo = (r: PromoRow, now: Date = new Date()): Promo => ({
  id: r.id,
  eventId: r.event_id,
  ticketTypeId: r.ticket_type_id,
  kind: r.kind,
  endsAt: r.ends_at,
  isActive: r.ends_at == null || new Date(r.ends_at) > now,
});

const toEvent = (r: EventRow): Event => ({
  id: r.id,
  slug: r.slug,
  organizationId: r.organization_id,
  createdBy: r.created_by,
  title: r.title,
  description: r.description,
  venue: r.venue,
  venueLat: r.venue_lat === null ? null : Number(r.venue_lat),
  venueLng: r.venue_lng === null ? null : Number(r.venue_lng),
  venueUrl: r.venue_url,
  venueSource: r.venue_source,
  venueLayoutUrl: r.venue_layout_url,
  coverUrl: r.cover_url,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  timezone: r.timezone,
  status: r.status,
  category: r.category,
  currency: r.currency,
  capacity: {
    totalCapacity: r.total_capacity,
    overbookPct: r.overbook_pct,
  },
  transferPolicy: {
    enabled: r.transfers_enabled,
    deadlineHours: r.transfer_deadline_hours,
    maxCount: r.transfer_max_count,
    requiresKyc: r.transfer_requires_kyc,
  },
  version: r.version,
  createdAt: r.created_at,
});

const toTicketType = (r: TicketTypeRow, tiers: PresaleTierRow[] = [], now: Date = new Date()): TicketType => {
  const myTiers = tiers.filter(t => t.ticket_type_id === r.id);
  const active = activePresaleTier(myTiers, now);
  const sorted = [...myTiers].sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());
  // Frontera ÚNICA donde la columna `capacity` (ambigua) se traduce a su
  // significado tipado: `seats` en un box, `stock` en una entrada. De aquí en
  // adelante el resto del código no puede confundirlos (unión discriminada).
  const base = {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    priceCents: r.price_cents,
    currency: r.currency,
    sold: r.sold,
    position: r.position,
    boxLabel: r.box_label,
    unitNoun: r.unit_noun,
    saleEndsAt: r.sale_ends_at,
    // presalePriceCents e isPresaleActive ahora vienen de los tiers
    presalePriceCents: active?.price_cents ?? null,
    presaleQty: r.presale_qty,
    presaleEndsAt: active?.ends_at ?? null,
    description: r.description,
    isFree: r.is_free,
    freeUntilAt: r.free_until_at,
    isFreeActive:
      r.is_free && (r.free_until_at == null || new Date(r.free_until_at) > now),
    saleStatus: computeSaleStatus(r, now),
    isPresaleActive: active != null,
    presaleTiers: sorted.map(t => ({
      id: t.id,
      ticketTypeId: t.ticket_type_id,
      priceCents: t.price_cents,
      endsAt: t.ends_at,
      position: t.position,
    })),
  };
  // Normaliza kinds: 'box' aparte; cualquier otro (incl. 'vip' rezagado o
  // 'invitation' previo a la migración de cortesías) cae a 'general'. Desacopla
  // el código del momento exacto en que corre la migración de DB.
  if (r.kind === "box") return { ...base, kind: "box", seats: r.capacity };
  return {
    ...base,
    kind: "general",
    stock: r.capacity,
  };
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60) || `evt-${Math.random().toString(36).slice(2, 8)}`;

export const supabaseEventRepository: EventRepository = {
  async listPublished(limit, cursor, category) {
    const db = supabaseAdmin();
    let q = db
      .from("events")
      .select("*")
      .eq("status", "published")
      .order("starts_at", { ascending: true })
      .limit(limit);
    if (cursor) q = q.gt("starts_at", cursor);
    if (category) q = q.eq("category", category);
    const { data } = await q;
    return (data as EventRow[] | null)?.map(toEvent) ?? [];
  },

  async listByOrganization(orgId) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("events")
      .select("*")
      .eq("organization_id", orgId)
      .order("starts_at", { ascending: false });
    const events = (data as EventRow[] | null)?.map(toEvent) ?? [];
    if (events.length === 0) return events;

    // Ventas reales por evento desde el rollup (una sola query), para que las
    // cards muestren vendido/aforo/recaudado sin inferir nada en el frontend.
    const { data: rollups } = await db
      .from("event_stats_rollup")
      .select("event_id, sold, capacity, revenue_cents")
      .in("event_id", events.map((e) => e.id));
    const byId = new Map(
      (rollups as Array<{ event_id: string; sold: number; capacity: number; revenue_cents: number }> | null)?.map(
        (r) => [r.event_id, r],
      ) ?? [],
    );
    return events.map((e) => {
      const r = byId.get(e.id);
      return {
        ...e,
        listStats: {
          sold: r?.sold ?? 0,
          capacity: r?.capacity ?? 0,
          revenueCents: r?.revenue_cents ?? 0,
        },
      };
    });
  },

  async getBySlug(slug) {
    const db = supabaseAdmin();
    const { data: event } = await db
      .from("events")
      .select("*")
      .eq("slug", slug)
      .maybeSingle<EventRow>();
    if (!event) return null;
    const { data: tts } = await db
      .from("ticket_types")
      .select("*")
      .eq("event_id", event.id)
      .order("position", { ascending: true });
    const { data: promos } = await db
      .from("ticket_promos")
      .select("id, event_id, ticket_type_id, kind, ends_at")
      .eq("event_id", event.id);
    const ttIds = (tts ?? []).map((t: TicketTypeRow) => t.id);
    const { data: tierRows } = ttIds.length > 0
      ? await db.from("ticket_type_presales").select("*").in("ticket_type_id", ttIds).order("position")
      : { data: [] };
    const now = new Date();
    return {
      event: toEvent(event),
      ticketTypes: (tts as TicketTypeRow[] | null)?.map((r) =>
        toTicketType(r, (tierRows as PresaleTierRow[] | null) ?? [], now),
      ) ?? [],
      promos: (promos as PromoRow[] | null)?.map((r) => toPromo(r)) ?? [],
    };
  },

  async create(input: CreateEventInput): Promise<Result<Event>> {
    const db = supabaseAdmin();
    const slug = `${slugify(input.title)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await db
      .from("events")
      .insert({
        slug,
        organization_id: input.organizationId,
        created_by: input.createdBy,
        title: input.title,
        description: input.description,
        venue: input.venue,
        venue_lat: input.venueLat,
        venue_lng: input.venueLng,
        venue_url: input.venueUrl,
        venue_source: input.venueSource,
        venue_layout_url: input.venueLayoutUrl,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        timezone: input.timezone,
        category: input.category ?? null,
        total_capacity: input.totalCapacity,
        overbook_pct: input.overbookPct,
        transfers_enabled: input.transfersEnabled,
        transfer_deadline_hours: input.transferDeadlineHours,
        transfer_max_count: input.transferMaxCount,
        transfer_requires_kyc: input.transferRequiresKyc,
      })
      .select("*")
      .single<EventRow>();
    if (error || !data) return err(error?.message ?? "event_create_failed");
    return ok(toEvent(data));
  },

  async publish(eventId, orgId): Promise<Result<Event>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("events")
      .update({ status: "published" })
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .select("*")
      .single<EventRow>();
    if (error || !data) return err(error?.message ?? "publish_failed");
    return ok(toEvent(data));
  },

  async listByOrgSlug(orgSlug) {
    const db = supabaseAdmin();
    const { data: org } = await db
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .maybeSingle<{ id: string }>();
    if (!org) return [];
    const { data } = await db
      .from("events")
      .select("*")
      .eq("organization_id", org.id)
      .in("status", ["published", "closed"])
      .order("starts_at", { ascending: true });
    return (data as EventRow[] | null)?.map(toEvent) ?? [];
  },

  async listPublishedByOrgSlug(orgSlug) {
    const db = supabaseAdmin();
    const { data: org } = await db
      .from("organizations")
      .select("id")
      .eq("slug", orgSlug)
      .maybeSingle<{ id: string }>();
    if (!org) return [];
    const { data } = await db
      .from("events")
      .select("*")
      .eq("organization_id", org.id)
      .eq("status", "published")
      .order("starts_at", { ascending: true });
    return (data as EventRow[] | null)?.map(toEvent) ?? [];
  },

  async update(eventId, orgId, input: UpdateEventInput): Promise<Result<Event>> {
    const db = supabaseAdmin();
    const patch: Record<string, unknown> = {};
    if (input.status !== undefined) patch.status = input.status;
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.venue !== undefined) patch.venue = input.venue;
    if (input.venueLat !== undefined) patch.venue_lat = input.venueLat;
    if (input.venueLng !== undefined) patch.venue_lng = input.venueLng;
    if (input.venueUrl !== undefined) patch.venue_url = input.venueUrl;
    if (input.venueSource !== undefined) patch.venue_source = input.venueSource;
    if (input.venueLayoutUrl !== undefined) patch.venue_layout_url = input.venueLayoutUrl;
    if (input.coverUrl !== undefined) patch.cover_url = input.coverUrl;
    if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
    if ("endsAt" in input) patch.ends_at = input.endsAt ?? null;
    if (input.category !== undefined) patch.category = input.category;
    if (input.totalCapacity !== undefined) patch.total_capacity = input.totalCapacity;
    if (input.overbookPct !== undefined) patch.overbook_pct = input.overbookPct;
    if (input.transfersEnabled !== undefined) patch.transfers_enabled = input.transfersEnabled;
    if (input.transferDeadlineHours !== undefined)
      patch.transfer_deadline_hours = input.transferDeadlineHours;
    if (input.transferMaxCount !== undefined) patch.transfer_max_count = input.transferMaxCount;
    if (input.transferRequiresKyc !== undefined)
      patch.transfer_requires_kyc = input.transferRequiresKyc;
    if (Object.keys(patch).length === 0) return err("nothing_to_update");
    const { data, error } = await db
      .from("events")
      .update(patch)
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .select("*")
      .single<EventRow>();
    if (error || !data) return err(error?.message ?? "update_failed");
    return ok(toEvent(data));
  },

  async getTicketType(ticketTypeId, eventId): Promise<TicketType | null> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("ticket_types")
      .select("*")
      .eq("id", ticketTypeId)
      .eq("event_id", eventId)
      .maybeSingle<TicketTypeRow>();
    return data ? toTicketType(data) : null;
  },

  async getPromoterScheme(eventId): Promise<EventPromoterScheme> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("events")
      .select(
        "promoter_commission_pct, promoter_commission_type, promoter_commission_config, promoter_default_quota",
      )
      .eq("id", eventId)
      .maybeSingle<{
        promoter_commission_pct: number | null;
        promoter_commission_type: CommissionType | null;
        promoter_commission_config: CommissionConfig | null;
        promoter_default_quota: number | null;
      }>();
    return {
      commissionPct: data?.promoter_commission_pct ?? null,
      commissionType: data?.promoter_commission_type ?? null,
      commissionConfig: data?.promoter_commission_config ?? null,
      defaultQuota: data?.promoter_default_quota ?? null,
    };
  },

  async updatePromoterScheme(eventId, patch): Promise<Result<true>> {
    const db = supabaseAdmin();
    const row: Record<string, unknown> = {};
    if ("commissionPct" in patch) row.promoter_commission_pct = patch.commissionPct;
    if ("commissionType" in patch) row.promoter_commission_type = patch.commissionType;
    if ("commissionConfig" in patch) row.promoter_commission_config = patch.commissionConfig;
    if ("defaultQuota" in patch) row.promoter_default_quota = patch.defaultQuota;
    if (Object.keys(row).length === 0) return ok(true);
    const { error } = await db.from("events").update(row).eq("id", eventId);
    if (error) return err(error.message);
    return ok(true);
  },

  async listPromos(eventId): Promise<Promo[]> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("ticket_promos")
      .select("id, event_id, ticket_type_id, kind, ends_at")
      .eq("event_id", eventId);
    return (data as PromoRow[] | null)?.map((r) => toPromo(r)) ?? [];
  },

  async setPromos(eventId, promos: PromoInput[]): Promise<Result<Promo[]>> {
    const db = supabaseAdmin();
    // Reemplazo total: borra las del evento y reinserta las dadas.
    const { error: delErr } = await db.from("ticket_promos").delete().eq("event_id", eventId);
    if (delErr) return err(delErr.message);
    if (promos.length === 0) return ok([]);
    const rows = promos.map((p) => ({
      event_id: eventId,
      ticket_type_id: p.ticketTypeId,
      kind: p.kind,
      ends_at: p.endsAt ?? null,
    }));
    const { data, error } = await db
      .from("ticket_promos")
      .insert(rows)
      .select("id, event_id, ticket_type_id, kind, ends_at");
    if (error || !data) return err(error?.message ?? "promos_set_failed");
    return ok((data as PromoRow[]).map((r) => toPromo(r)));
  },

  async createTicketType(eventId, input: CreateTicketTypeInput): Promise<Result<TicketType>> {
    const db = supabaseAdmin();
    // next position = max(position) + 1
    const { data: maxRow } = await db
      .from("ticket_types")
      .select("position")
      .eq("event_id", eventId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle<{ position: number }>();
    const position = (maxRow?.position ?? -1) + 1;
    const { data, error } = await db
      .from("ticket_types")
      .insert({
        event_id: eventId,
        name: input.name,
        kind: input.kind,
        price_cents: input.priceCents,
        capacity: input.capacity,
        position,
        box_label: input.kind === "box" ? input.boxLabel?.trim() ?? null : null,
        unit_noun:
          input.kind === "box" && input.unitNoun?.trim()
            ? input.unitNoun.trim()
            : null,
        sale_ends_at: input.saleEndsAt ?? null,
        presale_price_cents: input.presalePriceCents ?? null,
        presale_qty: input.presaleQty ?? null,
        presale_ends_at: input.presaleEndsAt ?? null,
        description: input.description ?? null,
        is_free: input.isFree ?? false,
        free_until_at: input.freeUntilAt ?? null,
      })
      .select("*")
      .single<TicketTypeRow>();
    if (error || !data) return err(error?.message ?? "ticket_type_create_failed");
    // Insertar tramos de preventa si se proporcionaron
    const tiers = input.presaleTiers ?? [];
    if (tiers.length > 0) {
      await db.from("ticket_type_presales").insert(
        tiers.map((t, i) => ({ ticket_type_id: data.id, price_cents: t.priceCents, ends_at: t.endsAt, position: i })),
      );
    }
    const { data: tierRows } = tiers.length > 0
      ? await db.from("ticket_type_presales").select("*").eq("ticket_type_id", data.id).order("position")
      : { data: [] };
    return ok(toTicketType(data, (tierRows as PresaleTierRow[] | null) ?? []));
  },

  async updateTicketType(
    ticketTypeId,
    eventId,
    input: UpdateTicketTypeInput,
  ): Promise<Result<TicketType>> {
    const db = supabaseAdmin();
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.priceCents !== undefined) patch.price_cents = input.priceCents;
    if (input.capacity !== undefined) patch.capacity = input.capacity;
    if (input.boxLabel !== undefined) patch.box_label = input.boxLabel;
    if (input.unitNoun !== undefined)
      patch.unit_noun = input.unitNoun?.trim() || null;
    if ("saleEndsAt" in input) patch.sale_ends_at = input.saleEndsAt ?? null;
    if ("presalePriceCents" in input) patch.presale_price_cents = input.presalePriceCents ?? null;
    if ("presaleQty" in input) patch.presale_qty = input.presaleQty ?? null;
    if ("presaleEndsAt" in input) patch.presale_ends_at = input.presaleEndsAt ?? null;
    if ("description" in input) patch.description = input.description ?? null;
    if ("isFree" in input) patch.is_free = input.isFree ?? false;
    if ("freeUntilAt" in input) patch.free_until_at = input.freeUntilAt ?? null;
    // presaleTiers se gestiona por separado (delete+insert)
    const hasTierUpdate = "presaleTiers" in input;
    if (Object.keys(patch).length === 0 && !hasTierUpdate) return err("nothing_to_update");
    let data: TicketTypeRow | null = null;
    if (Object.keys(patch).length > 0) {
      const { data: d, error } = await db
        .from("ticket_types")
        .update(patch)
        .eq("id", ticketTypeId)
        .eq("event_id", eventId)
        .select("*")
        .single<TicketTypeRow>();
      if (error || !d) return err(error?.message ?? "ticket_type_update_failed");
      data = d;
    } else {
      const { data: d } = await db
        .from("ticket_types")
        .select("*")
        .eq("id", ticketTypeId)
        .eq("event_id", eventId)
        .single<TicketTypeRow>();
      data = d;
    }
    if (!data) return err("ticket_type_not_found");
    // Reemplazar tiers si se proporcionaron
    if (hasTierUpdate) {
      await db.from("ticket_type_presales").delete().eq("ticket_type_id", ticketTypeId);
      const newTiers = (input.presaleTiers ?? []);
      if (newTiers.length > 0) {
        await db.from("ticket_type_presales").insert(
          newTiers.map((t, i) => ({ ticket_type_id: ticketTypeId, price_cents: t.priceCents, ends_at: t.endsAt, position: i })),
        );
      }
    }
    const { data: tierRows } = await db.from("ticket_type_presales").select("*").eq("ticket_type_id", ticketTypeId).order("position");
    return ok(toTicketType(data, (tierRows as PresaleTierRow[] | null) ?? []));
  },

  async deleteTicketType(ticketTypeId, eventId): Promise<Result<{ id: string }>> {
    const db = supabaseAdmin();
    const { error } = await db
      .from("ticket_types")
      .delete()
      .eq("id", ticketTypeId)
      .eq("event_id", eventId);
    if (error) return err(error.message);
    return ok({ id: ticketTypeId });
  },

  async getStats(eventId: string): Promise<EventStats> {
    const db = supabaseAdmin();
    // Necesitamos `starts_at` para decidir si el evento ya empezó al evaluar
    // la flag de autoventa (eventos futuros siempre quedan en `ok`).
    const { data: eventRow } = await db
      .from("events")
      .select("starts_at")
      .eq("id", eventId)
      .maybeSingle<{ starts_at: string }>();
    const eventStartsAt = eventRow?.starts_at ?? null;
    const eventHasStarted =
      eventStartsAt !== null && new Date(eventStartsAt).getTime() <= Date.now();

    const { data: tts } = await db
      .from("ticket_types")
      .select("id, name, kind, price_cents, capacity, box_label, unit_noun")
      .eq("event_id", eventId)
      .order("position", { ascending: true });
    const ticketTypeRows =
      (tts as Array<{
        id: string;
        name: string;
        kind: TicketType["kind"];
        price_cents: number;
        capacity: number;
        box_label: string | null;
        unit_noun: string | null;
      }> | null) ?? [];

    // KPIs escalares desde el view de rollup (una sola query): vendidas (pagado),
    // reservadas (pending <30min), validadas, recaudado y aforo. Esto reemplaza
    // las cuentas que antes sumaban `ticket_types.sold` (que mezcla reservado).
    const { data: rollup } = await db
      .from("event_stats_rollup")
      .select("capacity, sold, reserved, validated, revenue_cents")
      .eq("event_id", eventId)
      .maybeSingle<{
        capacity: number;
        sold: number;
        reserved: number;
        validated: number;
        revenue_cents: number;
      }>();
    const sold = rollup?.sold ?? 0;
    const reserved = rollup?.reserved ?? 0;
    const capacity = rollup?.capacity ?? 0;
    const validatedCount = rollup?.validated ?? 0;
    const revenueCents = rollup?.revenue_cents ?? 0;

    // Vendidas por tipo (pagadas, activas/usadas) para el desglose del reporte —
    // NO usamos `ticket_types.sold` porque incluye reservas pendientes.
    const PAGE = 1000;
    const paidTickets: Array<{ ticket_type_id: string; price_cents: number | null; status: string }> = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page } = await db
        .from("tickets")
        .select("ticket_type_id, price_cents, status, order:orders!inner(event_id, status)")
        .eq("order.event_id", eventId)
        .eq("order.status", "paid")
        .in("status", ["active", "used"])
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      const rows =
        (page as Array<{ ticket_type_id: string; price_cents: number | null; status: string }> | null) ?? [];
      paidTickets.push(...rows);
      if (rows.length < PAGE) break;
    }
    const soldByType = new Map<string, number>();
    // Validadas por tipo (status 'used') — en un box, personas que ya entraron.
    const validatedByType = new Map<string, number>();
    // Recaudado real por tipo = suma de price_cents de los tickets pagados
    // (con promos ya aplicadas al momento de la compra). Cuadra con el total
    // del rollup; nunca se recalcula precio×vendidos en el frontend.
    const revenueByType = new Map<string, number>();
    for (const t of paidTickets) {
      soldByType.set(t.ticket_type_id, (soldByType.get(t.ticket_type_id) ?? 0) + 1);
      revenueByType.set(t.ticket_type_id, (revenueByType.get(t.ticket_type_id) ?? 0) + (t.price_cents ?? 0));
      if (t.status === "used") {
        validatedByType.set(t.ticket_type_id, (validatedByType.get(t.ticket_type_id) ?? 0) + 1);
      }
    }
    const ticketTypes = ticketTypeRows.map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      price_cents: t.price_cents,
      capacity: t.capacity,
      sold: soldByType.get(t.id) ?? 0,
      validated: validatedByType.get(t.id) ?? 0,
      revenueCents: revenueByType.get(t.id) ?? 0,
      boxLabel: t.box_label,
      unitNoun: t.unit_noun,
    }));

    // Esquema de comisión a nivel evento (default para todos los promotores).
    // Se hereda entre el override del link y el default de la marca.
    const { data: schemeRow } = await db
      .from("events")
      .select(
        "promoter_commission_pct, promoter_commission_type, promoter_commission_config",
      )
      .eq("id", eventId)
      .maybeSingle<{
        promoter_commission_pct: number | null;
        promoter_commission_type: CommissionType | null;
        promoter_commission_config: unknown;
      }>();
    const eventScheme = schemeRow ?? {
      promoter_commission_pct: null,
      promoter_commission_type: null,
      promoter_commission_config: null,
    };

    const { data: promoterOrders } = await db
      .from("orders")
      .select(
        "id, total_cents, promoter_link_id, promoter_link:promoter_links!inner(id, code, promoter_id, org_promoter_id, commission_pct, commission_type, commission_config_override, profile:profiles(id, full_name), org_promoter:org_promoters(id, name, default_commission_pct, commission_type, commission_config))",
      )
      .eq("event_id", eventId)
      .eq("status", "paid")
      .not("promoter_link_id", "is", null);

    type PromoterOrderRow = {
      id: string;
      total_cents: number;
      promoter_link_id: string;
      promoter_link: {
        id: string;
        code: string;
        promoter_id: string | null;
        org_promoter_id: string | null;
        commission_pct: number | null;
        commission_type: CommissionType | null;
        commission_config_override: unknown;
        profile: { id: string; full_name: string | null } | null;
        org_promoter: {
          id: string;
          name: string;
          default_commission_pct: number;
          commission_type: "percentage" | "tiered" | "inkind";
          commission_config: unknown;
        } | null;
      };
    };

    const pOrders = (promoterOrders as unknown as PromoterOrderRow[] | null) ?? [];

    const orderIds = pOrders.map((o) => o.id);
    let ticketsByOrder = new Map<string, { sold: number; validated: number }>();
    if (orderIds.length > 0) {
      const { data: pTickets } = await db
        .from("tickets")
        .select("order_id, status")
        .in("order_id", orderIds);
      const rows =
        (pTickets as Array<{ order_id: string; status: "active" | "used" | "void" | "refunded" }> | null) ?? [];
      ticketsByOrder = rows.reduce((acc, t) => {
        // Solo cuentan vendidas las activas/usadas. void/refunded NO suman —
        // si no, inflan ticketsSold y se sobrepaga comisión por entradas
        // anuladas o reembolsadas (alinea con soldByType).
        if (t.status !== "active" && t.status !== "used") return acc;
        const entry = acc.get(t.order_id) ?? { sold: 0, validated: 0 };
        entry.sold += 1;
        if (t.status === "used") entry.validated += 1;
        acc.set(t.order_id, entry);
        return acc;
      }, new Map<string, { sold: number; validated: number }>());
    }

    const promoterAgg = new Map<
      string,
      {
        promoterId: string;
        promoterLinkId: string;
        code: string;
        name: string;
        ticketsSold: number;
        ticketsValidated: number;
        // Entradas gratis (orden total 0) atribuidas al link. Se cuentan aparte
        // de las ventas porque el organizador las trata distinto (convocatoria,
        // no comisión).
        guestsInvited: number;
        guestsEntered: number;
        revenueCents: number;
        commissionType: CommissionType;
        commissionPct: number;
        commissionConfig: CommissionConfig;
      }
    >();
    for (const o of pOrders) {
      const key = o.promoter_link.id;
      const counts = ticketsByOrder.get(o.id) ?? { sold: 0, validated: 0 };
      const displayName =
        o.promoter_link.profile?.full_name ??
        o.promoter_link.org_promoter?.name ??
        o.promoter_link.code;
      // Esquema efectivo por herencia: link override → esquema del evento → marca.
      const op = o.promoter_link.org_promoter;
      const {
        type: commissionType,
        config: commissionConfig,
        pct: commissionPct,
      } = resolveCommissionScheme({
        linkType: o.promoter_link.commission_type,
        linkPct: o.promoter_link.commission_pct,
        linkConfigOverride: o.promoter_link.commission_config_override,
        eventType: eventScheme.promoter_commission_type,
        eventConfig: eventScheme.promoter_commission_config,
        eventPct: eventScheme.promoter_commission_pct,
        orgType: op?.commission_type ?? null,
        orgConfig: op?.commission_config ?? null,
        orgPct: op?.default_commission_pct ?? null,
      });
      const entry = promoterAgg.get(key) ?? {
        promoterId: o.promoter_link.promoter_id ?? o.promoter_link.org_promoter_id ?? o.promoter_link.id,
        promoterLinkId: o.promoter_link.id,
        code: o.promoter_link.code,
        name: displayName,
        ticketsSold: 0,
        ticketsValidated: 0,
        guestsInvited: 0,
        guestsEntered: 0,
        revenueCents: 0,
        commissionType,
        commissionPct,
        commissionConfig,
      };
      // Orden con monto > 0 = venta (comisiona). Orden de S/0 = entrada gratis
      // (convocatoria). Se separan para que el reporte del promotor no mezcle
      // "vendió 30" con "metió 18 gratis".
      if ((o.total_cents ?? 0) > 0) {
        entry.ticketsSold += counts.sold;
        entry.ticketsValidated += counts.validated;
      } else {
        entry.guestsInvited += counts.sold;
        entry.guestsEntered += counts.validated;
      }
      entry.revenueCents += o.total_cents ?? 0;
      promoterAgg.set(key, entry);
    }
    // Calcular attendanceRate + flag de autoventa para cada promotor.
    // Reglas (ver EventRepository.byPromoter):
    //   - sample < 5  → ok (estadística poco confiable)
    //   - evento futuro → ok (todavía no hubo oportunidad de validar)
    //   - rate ≥ 0.7  → ok
    //   - 0.3 ≤ rate < 0.7 → watch
    //   - rate < 0.3  → suspect
    const byPromoter = Array.from(promoterAgg.values())
      .map((p) => {
        const attendanceRate =
          p.ticketsSold > 0 ? p.ticketsValidated / p.ticketsSold : 0;
        let flag: "ok" | "watch" | "suspect" = "ok";
        if (p.ticketsSold < 5 || !eventHasStarted) {
          flag = "ok";
        } else if (attendanceRate >= 0.7) {
          flag = "ok";
        } else if (attendanceRate >= 0.3) {
          flag = "watch";
        } else {
          flag = "suspect";
        }
        const payout = computePromoterPayout({
          type: p.commissionType,
          config: p.commissionConfig,
          pct: p.commissionPct,
          ticketsSold: p.ticketsSold,
          grossCents: p.revenueCents,
        });
        return {
          promoterId: p.promoterId,
          promoterLinkId: p.promoterLinkId,
          code: p.code,
          name: p.name,
          ticketsSold: p.ticketsSold,
          ticketsValidated: p.ticketsValidated,
          guestsInvited: p.guestsInvited,
          guestsEntered: p.guestsEntered,
          revenueCents: p.revenueCents,
          attendanceRate,
          flag,
          commissionType: p.commissionType,
          commissionPct: p.commissionPct,
          payoutCents: payout.payoutCents,
          unlockedRewards: payout.rewards,
        };
      })
      .sort((a, b) => b.ticketsSold - a.ticketsSold);

    // Serie diaria desde el view `event_sales_by_day` (migración
    // 20260527140000). Sólo cuenta tickets active/used de orders paid.
    const { data: seriesRows } = await db
      .from("event_sales_by_day")
      .select("day, tickets_sold, revenue_cents")
      .eq("event_id", eventId)
      .order("day", { ascending: true });
    const salesSeries =
      (seriesRows as Array<{ day: string; tickets_sold: number; revenue_cents: number }> | null)?.map(
        (r) => ({
          day: r.day,
          ticketsSold: Number(r.tickets_sold ?? 0),
          revenueCents: Number(r.revenue_cents ?? 0),
        }),
      ) ?? [];

    return {
      sold,
      reserved,
      validated: validatedCount,
      revenueCents,
      capacity: capacity || null,
      salesSeries,
      ticketTypes: ticketTypes.map((t) => ({
        id: t.id,
        name: t.name,
        kind: t.kind,
        priceCents: t.price_cents,
        capacity: t.capacity,
        sold: t.sold,
        validated: t.validated,
        revenueCents: t.revenueCents,
        boxLabel: t.boxLabel,
        unitNoun: t.unitNoun,
      })),
      byPromoter,
    };
  },

  async exportData(eventId: string) {
    const db = supabaseAdmin();

    // Tickets joined with ticket_type, order (+ buyer profile, promoter_link).
    // Solo entradas realmente válidas: orden pagada + ticket active/used (excluye
    // pending/expired/void/refunded — antes contaminaban la hoja Asistentes y no
    // cuadraban con el Resumen). Paginado en bloques de 1000 porque PostgREST
    // corta a 1000 filas SIN error → eventos grandes exportaban incompletos.
    const PAGE = 1000;
    const ticketRows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page } = await db
        .from("tickets")
        .select(
          `id, holder_name, holder_dni_enc, holder_dni_last4, status, used_at, order_id,
           ticket_type:ticket_types!inner(id, name),
           order:orders!inner(
             id, event_id, promoter_link_id, status,
             buyer:profiles!inner(id, email, phone),
             promoter_link:promoter_links(id, code)
           )`,
        )
        .eq("order.event_id", eventId)
        .eq("order.status", "paid")
        .in("status", ["active", "used"])
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      const rows = page ?? [];
      ticketRows.push(...rows);
      if (rows.length < PAGE) break;
    }

    type TicketJoinRow = {
      id: string;
      holder_name: string | null;
      holder_dni_enc: string | null;
      holder_dni_last4: string | null;
      status: AttendeeRow["status"];
      used_at: string | null;
      order_id: string;
      ticket_type: { id: string; name: string };
      order: {
        id: string;
        event_id: string;
        promoter_link_id: string | null;
        buyer: { id: string; email: string | null; phone: string | null };
        promoter_link: { id: string; code: string } | null;
      };
    };

    const attendees: AttendeeRow[] =
      ((ticketRows as unknown as TicketJoinRow[] | null) ?? []).map((t) => ({
        ticketId: t.id,
        holderName: t.holder_name,
        // DNI completo descifrado para la hoja del organizador. Si no hay enc
        // (compras viejas), cae a "··"+last4 como pista, o vacío.
        holderDni:
          decryptDni(t.holder_dni_enc) ??
          (t.holder_dni_last4 ? `··${t.holder_dni_last4}` : null),
        ticketTypeName: t.ticket_type?.name ?? "",
        status: t.status,
        usedAt: t.used_at,
        orderId: t.order_id,
        buyerEmail: t.order?.buyer?.email ?? null,
        buyerPhone: t.order?.buyer?.phone ?? null,
        promoterCode: t.order?.promoter_link?.code ?? null,
      }));

    const summary = await this.getStats(eventId);

    // Use payoutCents already resolved by getStats (handles percentage/tiered/inkind).
    const promoters: PromoterReportRow[] = summary.byPromoter.map((p) => ({
      name: p.name,
      code: p.code,
      ticketsSold: p.ticketsSold,
      ticketsValidated: p.ticketsValidated,
      guestsInvited: p.guestsInvited,
      guestsEntered: p.guestsEntered,
      revenueCents: p.revenueCents,
      commissionPct: p.commissionPct,
      commissionCalculatedCents: p.payoutCents,
    }));

    return { attendees, promoters, summary };
  },

  async listScans(eventId: string, limit: number): Promise<ScanFeedItem[]> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("scan_events")
      .select(
        "id, result, scanned_at, ticket_id, scanned_by, ticket:tickets(ticket_type:ticket_types(kind, name, box_label, unit_noun))",
      )
      .eq("event_id", eventId)
      .order("scanned_at", { ascending: false })
      .limit(limit);
    type Row = {
      id: string;
      result: ScanFeedItem["result"];
      scanned_at: string;
      ticket_id: string | null;
      scanned_by: string;
      ticket: {
        ticket_type: { kind: TicketType["kind"]; name: string; box_label: string | null; unit_noun: string | null } | null;
      } | null;
    };
    return (
      (data as Row[] | null)?.map((r) => ({
        id: r.id,
        result: r.result,
        scannedAt: r.scanned_at,
        ticketId: r.ticket_id,
        scannedBy: r.scanned_by,
        ticketTypeKind: r.ticket?.ticket_type?.kind ?? null,
        ticketTypeName: r.ticket?.ticket_type?.name ?? null,
        boxLabel: r.ticket?.ticket_type?.box_label ?? null,
        unitNoun: r.ticket?.ticket_type?.unit_noun ?? null,
      })) ?? []
    );
  },

  async getDoorHealth(eventId) {
    const db = supabaseAdmin();
    const nowIso = new Date().toISOString();
    const [sessionsRes, dupRes] = await Promise.all([
      db
        .from("scanner_sessions")
        .select("device_id, last_sync_at, expires_at, holder_name, dni_last2, zones(name)")
        .eq("event_id", eventId)
        .eq("revoked", false)
        .gt("expires_at", nowIso)
        .order("last_sync_at", { ascending: true }),
      db
        .from("scan_events")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("flag", "dup_offline"),
    ]);

    type SessionRow = {
      device_id: string;
      last_sync_at: string | null;
      expires_at: string;
      holder_name: string | null;
      dni_last2: string | null;
      zones: { name: string } | null;
    };
    // Staleness calculado server-side (reloj del server, confiable) en vez del
    // Date.now() del navegador, que podía dar falsos positivos.
    const STALE_MIN = 3;
    const nowMs = Date.now();
    const doors = ((sessionsRes.data as SessionRow[] | null) ?? []).map((s) => {
      const minutesSinceSync =
        s.last_sync_at === null
          ? null
          : Math.floor((nowMs - new Date(s.last_sync_at).getTime()) / 60000);
      return {
        deviceId: s.device_id,
        zoneName: s.zones?.name ?? null,
        lastSyncAt: s.last_sync_at,
        expiresAt: s.expires_at,
        minutesSinceSync,
        isStale: minutesSinceSync === null || minutesSinceSync >= STALE_MIN,
        holderName: s.holder_name,
        dniLast2: s.dni_last2,
      };
    });

    return { doors, dupOffline: dupRes.count ?? 0 };
  },
};

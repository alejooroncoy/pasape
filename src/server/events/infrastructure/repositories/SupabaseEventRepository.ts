import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type {
  AttendeeRow,
  CreateEventInput,
  CreateTicketTypeInput,
  EventRepository,
  EventStats,
  PromoInput,
  PromoterReportRow,
  ScanFeedItem,
  UpdateEventInput,
  UpdateTicketTypeInput,
} from "@/server/events/ports/EventRepository";
import type { Event, EventCategory, Promo, TicketType } from "@/server/events/domain/Event";
import { computePromoterPayout } from "@/server/promoters/application/CommissionResolver";
import type {
  CommissionConfig,
  CommissionType,
} from "@/server/promoters/domain/OrgPromoter";

/**
 * Parse a raw jsonb `commission_config` value into the typed shape used by
 * the commission resolver. Malformed input collapses to `null` so callers
 * can safely fall back to defaults.
 */
const coerceCommissionConfig = (
  type: CommissionType,
  raw: unknown,
): CommissionConfig => {
  if (raw == null || type === "percentage") return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (type === "tiered") {
    const tiers = obj.tiers;
    if (!Array.isArray(tiers)) return null;
    const clean = tiers.flatMap((t) => {
      if (!t || typeof t !== "object") return [];
      const row = t as Record<string, unknown>;
      const salesCount = Number(row.salesCount);
      const payoutCents = Number(row.payoutCents);
      if (!Number.isFinite(salesCount) || !Number.isFinite(payoutCents)) return [];
      return [{ salesCount: Math.trunc(salesCount), payoutCents: Math.trunc(payoutCents) }];
    });
    return { tiers: clean };
  }
  const rewards = obj.rewards;
  if (!Array.isArray(rewards)) return null;
  const clean = rewards.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const row = r as Record<string, unknown>;
    const salesCount = Number(row.salesCount);
    const label = typeof row.label === "string" ? row.label : "";
    const icon = typeof row.icon === "string" ? row.icon : "";
    if (!Number.isFinite(salesCount) || !label || !icon) return [];
    return [{ salesCount: Math.trunc(salesCount), label, icon }];
  });
  return { rewards: clean };
};

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
  zone: string | null;
  unit_noun: string | null;
  sale_ends_at: string | null;
  presale_price_cents: number | null;
  presale_qty: number | null;
  presale_ends_at: string | null;
  description: string | null;
};

type PromoRow = {
  id: string;
  event_id: string;
  ticket_type_id: string;
  kind: Promo["kind"];
  ends_at: string | null;
};

const computeSaleStatus = (
  r: TicketTypeRow,
  now: Date,
): "available" | "expired" | "soldout" => {
  if (r.sale_ends_at && new Date(r.sale_ends_at) < now) return "expired";
  if (r.kind === "box") return r.sold > 0 ? "soldout" : "available";
  return r.capacity - r.sold > 0 ? "available" : "soldout";
};

const computeIsPresaleActive = (r: TicketTypeRow, now: Date): boolean => {
  if (r.presale_price_cents == null) return false;
  const qtyOk = r.presale_qty == null || r.sold < r.presale_qty;
  const dateOk = r.presale_ends_at == null || now < new Date(r.presale_ends_at);
  return qtyOk && dateOk;
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

const toTicketType = (r: TicketTypeRow, now: Date = new Date()): TicketType => ({
  id: r.id,
  eventId: r.event_id,
  name: r.name,
  kind: r.kind,
  priceCents: r.price_cents,
  currency: r.currency,
  capacity: r.capacity,
  sold: r.sold,
  position: r.position,
  boxLabel: r.box_label,
  zone: r.zone,
  unitNoun: r.unit_noun,
  saleEndsAt: r.sale_ends_at,
  presalePriceCents: r.presale_price_cents,
  presaleQty: r.presale_qty,
  presaleEndsAt: r.presale_ends_at,
  description: r.description,
  saleStatus: computeSaleStatus(r, now),
  isPresaleActive: computeIsPresaleActive(r, now),
});

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
    return (data as EventRow[] | null)?.map(toEvent) ?? [];
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
    return {
      event: toEvent(event),
      ticketTypes: (tts as TicketTypeRow[] | null)?.map((r) => toTicketType(r)) ?? [],
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
        zone: input.zone?.trim() || null,
        unit_noun:
          input.kind === "box" && input.unitNoun?.trim()
            ? input.unitNoun.trim()
            : null,
        sale_ends_at: input.saleEndsAt ?? null,
        presale_price_cents: input.presalePriceCents ?? null,
        presale_qty: input.presaleQty ?? null,
        presale_ends_at: input.presaleEndsAt ?? null,
        description: input.description ?? null,
      })
      .select("*")
      .single<TicketTypeRow>();
    if (error || !data) return err(error?.message ?? "ticket_type_create_failed");
    return ok(toTicketType(data));
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
    if (input.zone !== undefined) patch.zone = input.zone?.trim() || null;
    if (input.unitNoun !== undefined)
      patch.unit_noun = input.unitNoun?.trim() || null;
    if ("saleEndsAt" in input) patch.sale_ends_at = input.saleEndsAt ?? null;
    if ("presalePriceCents" in input) patch.presale_price_cents = input.presalePriceCents ?? null;
    if ("presaleQty" in input) patch.presale_qty = input.presaleQty ?? null;
    if ("presaleEndsAt" in input) patch.presale_ends_at = input.presaleEndsAt ?? null;
    if ("description" in input) patch.description = input.description ?? null;
    if (Object.keys(patch).length === 0) return err("nothing_to_update");
    const { data, error } = await db
      .from("ticket_types")
      .update(patch)
      .eq("id", ticketTypeId)
      .eq("event_id", eventId)
      .select("*")
      .single<TicketTypeRow>();
    if (error || !data) return err(error?.message ?? "ticket_type_update_failed");
    return ok(toTicketType(data));
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
      .select("id, name, kind, price_cents, capacity, sold")
      .eq("event_id", eventId)
      .order("position", { ascending: true });
    const ticketTypes =
      (tts as Array<{
        id: string;
        name: string;
        kind: TicketType["kind"];
        price_cents: number;
        capacity: number;
        sold: number;
      }> | null) ?? [];

    const sold = ticketTypes.reduce((acc, t) => acc + (t.sold ?? 0), 0);
    const capacity = ticketTypes.reduce((acc, t) => acc + (t.capacity ?? 0), 0);

    const { count: validatedCount } = await db
      .from("scan_events")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("result", "valid");

    const { data: paidOrders } = await db
      .from("orders")
      .select("total_cents")
      .eq("event_id", eventId)
      .eq("status", "paid");
    const revenueCents =
      (paidOrders as Array<{ total_cents: number }> | null)?.reduce(
        (acc, o) => acc + (o.total_cents ?? 0),
        0,
      ) ?? 0;

    const { data: promoterOrders } = await db
      .from("orders")
      .select(
        "id, total_cents, promoter_link_id, promoter_link:promoter_links!inner(id, code, promoter_id, org_promoter_id, commission_pct, commission_config_override, profile:profiles(id, full_name), org_promoter:org_promoters(id, name, default_commission_pct, commission_type, commission_config))",
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
        commission_pct: number;
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
      // Commission resolution:
      //   - type comes from org_promoter (the per-event link doesn't carry it yet);
      //     falls back to "percentage" for legacy links without an org_promoter.
      //   - pct uses the per-link override (commission_pct) when present.
      //   - config: per-link override jsonb if present, otherwise the org default.
      const op = o.promoter_link.org_promoter;
      const commissionType: CommissionType = op?.commission_type ?? "percentage";
      const overrideCfg = coerceCommissionConfig(
        commissionType,
        o.promoter_link.commission_config_override,
      );
      const baseCfg = op
        ? coerceCommissionConfig(commissionType, op.commission_config)
        : null;
      const commissionConfig = overrideCfg ?? baseCfg;
      const commissionPct = o.promoter_link.commission_pct ?? op?.default_commission_pct ?? 0;
      const entry = promoterAgg.get(key) ?? {
        promoterId: o.promoter_link.promoter_id ?? o.promoter_link.org_promoter_id ?? o.promoter_link.id,
        promoterLinkId: o.promoter_link.id,
        code: o.promoter_link.code,
        name: displayName,
        ticketsSold: 0,
        ticketsValidated: 0,
        revenueCents: 0,
        commissionType,
        commissionPct,
        commissionConfig,
      };
      entry.ticketsSold += counts.sold;
      entry.ticketsValidated += counts.validated;
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
      validated: validatedCount ?? 0,
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
      })),
      byPromoter,
    };
  },

  async exportData(eventId: string) {
    const db = supabaseAdmin();

    // Tickets joined with ticket_type, order (+ buyer profile, promoter_link).
    const { data: ticketRows } = await db
      .from("tickets")
      .select(
        `id, holder_name, status, used_at, order_id,
         ticket_type:ticket_types!inner(id, name),
         order:orders!inner(
           id, event_id, promoter_link_id,
           buyer:profiles!inner(id, email, phone),
           promoter_link:promoter_links(id, code)
         )`,
      )
      .eq("order.event_id", eventId);

    type TicketJoinRow = {
      id: string;
      holder_name: string | null;
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
      .select("id, result, scanned_at, ticket_id, scanned_by")
      .eq("event_id", eventId)
      .order("scanned_at", { ascending: false })
      .limit(limit);
    type Row = {
      id: string;
      result: ScanFeedItem["result"];
      scanned_at: string;
      ticket_id: string | null;
      scanned_by: string;
    };
    return (
      (data as Row[] | null)?.map((r) => ({
        id: r.id,
        result: r.result,
        scannedAt: r.scanned_at,
        ticketId: r.ticket_id,
        scannedBy: r.scanned_by,
      })) ?? []
    );
  },
};

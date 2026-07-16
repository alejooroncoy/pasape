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
import type { Event, EventCard, EventCategory, EventSeoEntry, FeeMode, Promo, PresaleTier, TicketType } from "@/server/events/domain/Event";
import { buyerUnitPriceCents } from "@/lib/tickets/serviceFee";
import { customFieldsSchema, type CustomField } from "@/lib/events/customFields";
import {
  computePromoterPayout,
  describePromoterMilestones,
  resolveCommissionScheme,
} from "@/server/promoters/application/CommissionResolver";
import type { CommissionConfig } from "@/server/promoters/domain/OrgPromoter";

// PostgREST corta a 1000 filas SIN error, así que cualquier paginado manual
// sobre esta tabla tiene que avanzar en bloques de este tamaño o el resultado
// queda incompleto en tablas grandes.
const POSTGREST_PAGE_LIMIT = 1000;

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
  palette_dark: string | null;
  palette_mid: string | null;
  palette_accent: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  status: Event["status"];
  rejected_reason: string | null;
  category: EventCategory | null;
  currency: string;
  total_capacity: number | null;
  overbook_pct: number;
  max_tickets_per_person: number | null;
  transfers_enabled: boolean;
  transfer_deadline_hours: number | null;
  transfer_max_count: number;
  transfer_requires_kyc: boolean;
  fee_mode: Event["feeMode"];
  custom_fields: unknown;
  version: number;
  created_at: string;
};

// Fila corrupta/legacy (columna nueva, filas viejas sin default aplicado, o
// un valor que ya no matchea el schema vigente) no debe tumbar el render del
// evento — degrada a "sin preguntas extra" y sigue.
const parseCustomFields = (raw: unknown): CustomField[] => {
  const parsed = customFieldsSchema.safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
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
  paletteDark: r.palette_dark,
  paletteMid: r.palette_mid,
  paletteAccent: r.palette_accent,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  timezone: r.timezone,
  status: r.status,
  rejectedReason: r.rejected_reason,
  category: r.category,
  currency: r.currency,
  capacity: {
    totalCapacity: r.total_capacity,
    overbookPct: r.overbook_pct,
  },
  maxTicketsPerPerson: r.max_tickets_per_person,
  transferPolicy: {
    enabled: r.transfers_enabled,
    deadlineHours: r.transfer_deadline_hours,
    maxCount: r.transfer_max_count,
    requiresKyc: r.transfer_requires_kyc,
  },
  feeMode: r.fee_mode,
  customFields: parseCustomFields(r.custom_fields),
  version: r.version,
  createdAt: r.created_at,
});

/**
 * Un solo mapa campo-de-dominio → columna-DB por cada shape reducido
 * (EventCard, EventSeoEntry). El string de `select()` y el mapper row→dominio
 * se derivan LOS DOS de este mapa: agregar/quitar un campo es una sola
 * edición, no dos listas hardcodeadas que hay que acordarse de mantener
 * sincronizadas a mano (antes: EVENT_CARD_COLUMNS + el cuerpo de toEventCard
 * podían divergir sin que tsc lo marcara). El `satisfies Record<keyof Shape,
 * keyof EventRow>` fuerza en compile-time que el mapa cubra exactamente las
 * keys del tipo de dominio y que cada valor sea una columna real de EventRow.
 */
function projectedEventMapper<M extends Record<string, keyof EventRow>>(fieldMap: M) {
  const columns = Object.values(fieldMap).join(", ");
  const toDomain = (row: Pick<EventRow, M[keyof M]>): { [K in keyof M]: EventRow[M[K]] } => {
    const out = {} as { [K in keyof M]: EventRow[M[K]] };
    for (const key of Object.keys(fieldMap) as Array<keyof M>) {
      out[key] = row[fieldMap[key]];
    }
    return out;
  };
  return { columns, toDomain };
}

const EVENT_CARD_FIELD_MAP = {
  id: "id",
  slug: "slug",
  title: "title",
  coverUrl: "cover_url",
  venue: "venue",
  startsAt: "starts_at",
  timezone: "timezone",
  category: "category",
} as const satisfies Record<keyof EventCard, keyof EventRow>;

type EventCardRow = Pick<EventRow, (typeof EVENT_CARD_FIELD_MAP)[keyof typeof EVENT_CARD_FIELD_MAP]>;
const { columns: EVENT_CARD_COLUMNS, toDomain: toEventCard } = projectedEventMapper(EVENT_CARD_FIELD_MAP);

const EVENT_SEO_FIELD_MAP = {
  slug: "slug",
  title: "title",
  description: "description",
  venue: "venue",
  startsAt: "starts_at",
  timezone: "timezone",
  status: "status",
  category: "category",
  createdAt: "created_at",
} as const satisfies Record<keyof EventSeoEntry, keyof EventRow>;

type EventSeoRow = Pick<EventRow, (typeof EVENT_SEO_FIELD_MAP)[keyof typeof EVENT_SEO_FIELD_MAP]>;
const { columns: EVENT_SEO_COLUMNS, toDomain: toEventSeoEntry } = projectedEventMapper(EVENT_SEO_FIELD_MAP);

const COUNTDOWN_WINDOW_MS = 6 * 3600_000;

const computeShowCountdown = (
  endsAt: string | null | undefined,
  now: Date,
): { showCountdown: boolean; countdownEndsAt: string | null } => {
  if (!endsAt) return { showCountdown: false, countdownEndsAt: null };
  const left = new Date(endsAt).getTime() - now.getTime();
  if (left <= 0 || left > COUNTDOWN_WINDOW_MS) {
    return { showCountdown: false, countdownEndsAt: null };
  }
  return { showCountdown: true, countdownEndsAt: endsAt };
};

const toTicketType = (
  r: TicketTypeRow,
  tiers: PresaleTierRow[] = [],
  now: Date = new Date(),
  feeMode: FeeMode = "buyer_pays_extra",
): TicketType => {
  const myTiers = tiers.filter(t => t.ticket_type_id === r.id);
  const active = activePresaleTier(myTiers, now);
  const sorted = [...myTiers].sort((a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime());
  // Precio activo (gratis gana sobre preventa, preventa sobre normal) — misma
  // regla que activePricing. De ahí sale el precio "todo incluido" del comprador.
  const isFreeActive = r.is_free && (r.free_until_at == null || new Date(r.free_until_at) > now);
  const activePriceCents = isFreeActive ? 0 : (active?.price_cents ?? r.price_cents);
  const countdownSource = isFreeActive
    ? r.free_until_at
    : active != null
      ? active.ends_at
      : null;
  const countdown = computeShowCountdown(countdownSource, now);
  // Frontera ÚNICA donde la columna `capacity` (ambigua) se traduce a su
  // significado tipado: `seats` en un box, `stock` en una entrada. De aquí en
  // adelante el resto del código no puede confundirlos (unión discriminada).
  const base = {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    priceCents: r.price_cents,
    buyerPriceCents: buyerUnitPriceCents(activePriceCents, feeMode),
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
    isFreeActive,
    saleStatus: computeSaleStatus(r, now),
    isPresaleActive: active != null,
    showCountdown: countdown.showCountdown,
    countdownEndsAt: countdown.countdownEndsAt,
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

/** Base compartida por listPublished/listPublishedForSeo — mismo filtro/orden,
 *  solo cambian las columnas seleccionadas y (en listPublished) los filtros
 *  extra. Evita que el criterio de "publicado" quede hardcodeado dos veces. */
const publishedEventsQuery = (db: ReturnType<typeof supabaseAdmin>, columns: string, limit: number) =>
  db
    .from("events")
    .select(columns)
    .eq("status", "published")
    .order("starts_at", { ascending: true })
    .limit(limit);

export const supabaseEventRepository: EventRepository = {
  async listPublished(limit, cursor, category, search) {
    const db = supabaseAdmin();
    // Select mínimo: este método solo alimenta listados públicos (home,
    // /eventos/[categoria], búsqueda del header) — FeaturedBanner/EventCard
    // no pintan description/palette*/venueLat-Lng/capacity/etc. El detalle
    // del evento (con esos campos) va por getBySlug, no por acá.
    let q = publishedEventsQuery(db, EVENT_CARD_COLUMNS, limit);
    if (cursor) q = q.gt("starts_at", cursor);
    if (category) q = q.eq("category", category);
    if (search) {
      // Escapar los metacaracteres del filtro `or()` de PostgREST (coma,
      // paréntesis, comodines) — el término del usuario es literal.
      const term = search.replace(/[%_,()]/g, " ").trim();
      if (term) q = q.or(`title.ilike.%${term}%,venue.ilike.%${term}%`);
    }
    const { data } = await q;
    return (data as EventCardRow[] | null)?.map(toEventCard) ?? [];
  },

  async listPublishedForSeo(limit) {
    const db = supabaseAdmin();
    const { data } = await publishedEventsQuery(db, EVENT_SEO_COLUMNS, limit);
    return (data as EventSeoRow[] | null)?.map(toEventSeoEntry) ?? [];
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
        toTicketType(r, (tierRows as PresaleTierRow[] | null) ?? [], now, event.fee_mode),
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
        cover_url: input.coverUrl ?? null,
        palette_dark: input.paletteDark ?? null,
        palette_mid: input.paletteMid ?? null,
        palette_accent: input.paletteAccent ?? null,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        timezone: input.timezone,
        category: input.category ?? null,
        total_capacity: input.totalCapacity,
        overbook_pct: input.overbookPct,
        max_tickets_per_person: input.maxTicketsPerPerson ?? null,
        transfers_enabled: input.transfersEnabled,
        transfer_deadline_hours: input.transferDeadlineHours,
        transfer_max_count: input.transferMaxCount,
        transfer_requires_kyc: input.transferRequiresKyc,
        fee_mode: input.feeMode ?? "buyer_pays_extra",
        custom_fields: input.customFields ?? [],
      })
      .select("*")
      .single<EventRow>();
    if (error || !data) return err(error?.message ?? "event_create_failed");
    return ok(toEvent(data));
  },

  // El organizador "publica", pero el evento queda en pending_review hasta
  // que Pasape lo aprueba manualmente (cambia el status en Supabase) — ver
  // AGENTS.md / [[review-eventos-pending]]. Solo published es visible al público.
  // Excepción: si `organizations.trusted = true`, nos saltamos la revisión y
  // publicamos directo — ver 20260707100000_organizations_trusted.sql.
  //
  // La transición SOLO se permite desde "draft" (el .eq("status","draft") es
  // parte del WHERE, no un chequeo previo) — nunca desde "published"/"closed"/
  // "cancelled", para que reintentar /publish desde una pestaña vieja (ver
  // new/success/page.tsx, que nunca refresca su status local) no pueda
  // des-publicar un evento ya aprobado y en vivo.
  //
  // Al estar el filtro en el propio UPDATE, la transición es atómica: bajo dos
  // requests concurrentes (doble clic), Postgres serializa el lock de fila y
  // solo UNA de las dos de verdad cambia el status (`transitioned: true`); la
  // otra ve la fila ya en pending_review, no escribe nada y vuelve con
  // `transitioned: false` — así el caller sabe si debe notificar sin fiarse de
  // un status leído antes de la escritura (que ya podría estar obsoleto).
  async publish(eventId, orgId): Promise<Result<{ event: Event; transitioned: boolean }>> {
    const db = supabaseAdmin();
    const { data: org } = await db
      .from("organizations")
      .select("trusted")
      .eq("id", orgId)
      .maybeSingle<{ trusted: boolean }>();
    const targetStatus = org?.trusted ? "published" : "pending_review";
    const { data, error } = await db
      .from("events")
      .update({ status: targetStatus })
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .eq("status", "draft")
      .select("*")
      .maybeSingle<EventRow>();
    if (error) return err(error.message);
    if (data) return ok({ event: toEvent(data), transitioned: true });

    // No hubo transición real (ya estaba pending_review/published/closed/
    // cancelled) — traemos el evento tal cual está, sin tocar su status.
    const { data: current, error: readError } = await db
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .maybeSingle<EventRow>();
    if (readError || !current) return err(readError?.message ?? "publish_failed");
    return ok({ event: toEvent(current), transitioned: false });
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
    if (input.rejectedReason !== undefined) patch.rejected_reason = input.rejectedReason;
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.venue !== undefined) patch.venue = input.venue;
    if (input.venueLat !== undefined) patch.venue_lat = input.venueLat;
    if (input.venueLng !== undefined) patch.venue_lng = input.venueLng;
    if (input.venueUrl !== undefined) patch.venue_url = input.venueUrl;
    if (input.venueSource !== undefined) patch.venue_source = input.venueSource;
    if (input.venueLayoutUrl !== undefined) patch.venue_layout_url = input.venueLayoutUrl;
    if (input.coverUrl !== undefined) patch.cover_url = input.coverUrl;
    if (input.paletteDark !== undefined) patch.palette_dark = input.paletteDark;
    if (input.paletteMid !== undefined) patch.palette_mid = input.paletteMid;
    if (input.paletteAccent !== undefined) patch.palette_accent = input.paletteAccent;
    if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
    if ("endsAt" in input) patch.ends_at = input.endsAt ?? null;
    if (input.category !== undefined) patch.category = input.category;
    if (input.totalCapacity !== undefined) patch.total_capacity = input.totalCapacity;
    if (input.overbookPct !== undefined) patch.overbook_pct = input.overbookPct;
    if (input.maxTicketsPerPerson !== undefined)
      patch.max_tickets_per_person = input.maxTicketsPerPerson;
    if (input.transfersEnabled !== undefined) patch.transfers_enabled = input.transfersEnabled;
    if (input.transferDeadlineHours !== undefined)
      patch.transfer_deadline_hours = input.transferDeadlineHours;
    if (input.transferMaxCount !== undefined) patch.transfer_max_count = input.transferMaxCount;
    if (input.transferRequiresKyc !== undefined)
      patch.transfer_requires_kyc = input.transferRequiresKyc;
    if (input.feeMode !== undefined) patch.fee_mode = input.feeMode;
    if (input.customFields !== undefined) patch.custom_fields = input.customFields;
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
        "promoter_commission_pct, promoter_commission_config, promoter_default_quota",
      )
      .eq("id", eventId)
      .maybeSingle<{
        promoter_commission_pct: number | null;
        promoter_commission_config: CommissionConfig | null;
        promoter_default_quota: number | null;
      }>();
    return {
      commissionPct: data?.promoter_commission_pct ?? null,
      commissionConfig: data?.promoter_commission_config ?? null,
      defaultQuota: data?.promoter_default_quota ?? null,
    };
  },

  async updatePromoterScheme(eventId, patch): Promise<Result<true>> {
    const db = supabaseAdmin();
    const row: Record<string, unknown> = {};
    // Dos ejes independientes: % por venta y metas. Coexisten.
    if ("commissionPct" in patch) row.promoter_commission_pct = patch.commissionPct;
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

    // Comisión de Pasape acumulada → neto del organizador. Mismo universo que
    // el rollup (órdenes pagadas); definición del negocio en serviceFee.ts:
    // ingreso del organizador = total_cents − service_fee_cents.
    const { data: feeRows } = await db
      .from("orders")
      .select("service_fee_cents")
      .eq("event_id", eventId)
      .eq("status", "paid");
    const serviceFeeCents = ((feeRows as Array<{ service_fee_cents: number | null }> | null) ?? []).reduce(
      (sum, o) => sum + (o.service_fee_cents ?? 0),
      0,
    );
    const netCents = revenueCents - serviceFeeCents;

    // Vendidas por tipo (pagadas, activas/usadas) para el desglose del reporte —
    // NO usamos `ticket_types.sold` porque incluye reservas pendientes.
    const PAGE = POSTGREST_PAGE_LIMIT;
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
        "promoter_commission_pct, promoter_commission_config, organization:organizations(promoter_commission_pct, promoter_commission_config)",
      )
      .eq("id", eventId)
      .maybeSingle<{
        promoter_commission_pct: number | null;
        promoter_commission_config: unknown;
        organization: {
          promoter_commission_pct: number | null;
          promoter_commission_config: unknown;
        } | null;
      }>();
    const eventScheme = schemeRow ?? {
      promoter_commission_pct: null,
      promoter_commission_config: null,
      organization: null,
    };

    const { data: promoterOrders } = await db
      .from("orders")
      .select(
        "id, total_cents, promoter_link_id, promoter_link:promoter_links!inner(id, code, promoter_id, org_promoter_id, commission_pct, commission_config_override, profile:profiles(id, full_name), org_promoter:org_promoters(id, name, default_commission_pct, commission_config))",
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
        commission_config_override: unknown;
        profile: { id: string; full_name: string | null } | null;
        org_promoter: {
          id: string;
          name: string;
          default_commission_pct: number | null;
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
      const { config: commissionConfig, pct: commissionPct } = resolveCommissionScheme({
        linkPct: o.promoter_link.commission_pct,
        linkConfigOverride: o.promoter_link.commission_config_override,
        promoterPct: op?.default_commission_pct ?? null,
        promoterConfig: op?.commission_config ?? null,
        eventPct: eventScheme.promoter_commission_pct,
        eventConfig: eventScheme.promoter_commission_config,
        brandPct: eventScheme.organization?.promoter_commission_pct ?? null,
        brandConfig: eventScheme.organization?.promoter_commission_config ?? null,
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
    //   - sample < MIN_SAMPLE_FOR_FLAG  → ok (estadística poco confiable)
    //   - evento futuro → ok (todavía no hubo oportunidad de validar)
    //   - rate ≥ ATTENDANCE_OK_THRESHOLD  → ok
    //   - ATTENDANCE_SUSPECT_THRESHOLD ≤ rate < ATTENDANCE_OK_THRESHOLD → watch
    //   - rate < ATTENDANCE_SUSPECT_THRESHOLD  → suspect
    const MIN_SAMPLE_FOR_FLAG = 5;
    const ATTENDANCE_OK_THRESHOLD = 0.7;
    const ATTENDANCE_SUSPECT_THRESHOLD = 0.3;
    const byPromoter = Array.from(promoterAgg.values())
      .map((p) => {
        const attendanceRate =
          p.ticketsSold > 0 ? p.ticketsValidated / p.ticketsSold : 0;
        let flag: "ok" | "watch" | "suspect" = "ok";
        if (p.ticketsSold < MIN_SAMPLE_FOR_FLAG || !eventHasStarted) {
          flag = "ok";
        } else if (attendanceRate >= ATTENDANCE_OK_THRESHOLD) {
          flag = "ok";
        } else if (attendanceRate >= ATTENDANCE_SUSPECT_THRESHOLD) {
          flag = "watch";
        } else {
          flag = "suspect";
        }
        // Asistidos = validados de pago + gratis que entraron (base attended).
        const attendedUnits = p.ticketsValidated + p.guestsEntered;
        const payout = computePromoterPayout({
          pct: p.commissionPct,
          config: p.commissionConfig,
          soldUnits: p.ticketsSold,
          attendedUnits,
          grossCents: p.revenueCents,
        });
        // Detalle de hitos (mismo criterio de desbloqueo que el payout) para el
        // reporte del organizador: base, conteo, cada meta y su estado.
        const milestonesView = describePromoterMilestones(
          p.commissionConfig,
          p.ticketsSold,
          attendedUnits,
        );
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
          commissionPct: p.commissionPct,
          hasMilestones: (p.commissionConfig?.milestones.length ?? 0) > 0,
          payoutCents: payout.payoutCents,
          unlockedRewards: payout.rewards,
          milestoneBasis: milestonesView.basis,
          milestoneCount: milestonesView.count,
          milestoneCashCents: milestonesView.cashUnlockedCents,
          milestones: milestonesView.milestones,
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
      serviceFeeCents,
      netCents,
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
    // cuadraban con el Resumen). Paginado en bloques de POSTGREST_PAGE_LIMIT
    // porque PostgREST corta a 1000 filas SIN error → eventos grandes exportaban incompletos.
    const PAGE = POSTGREST_PAGE_LIMIT;
    const ticketRows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      // OJO: orders tiene DOS FKs a profiles (buyer_id y claimed_by) — hay que
      // desambiguar con !orders_buyer_id_fkey o PostgREST devuelve PGRST201.
      // El buyer va LEFT (sin !inner): una orden guest/claim raro no debe
      // desaparecer de la hoja Asistentes.
      const { data: page, error } = await db
        .from("tickets")
        .select(
          `id, holder_name, holder_dni_enc, holder_dni_last4, status, used_at, order_id,
           box_label, box_host_ticket_id, current_holder, transfer_count,
           ticket_type:ticket_types!inner(id, name, unit_noun),
           holder:profiles!tickets_current_holder_fkey(id, phone),
           order:orders!inner(
             id, event_id, promoter_link_id, status, is_courtesy,
             guest_email, guest_phone, custom_field_answers,
             buyer:profiles!orders_buyer_id_fkey(id, email, phone),
             promoter_link:promoter_links(id, code)
           )`,
        )
        .eq("order.event_id", eventId)
        .eq("order.status", "paid")
        .in("status", ["active", "used"])
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`exportData tickets: ${error.message}`);
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
      box_label: string | null;
      box_host_ticket_id: string | null;
      current_holder: string;
      transfer_count: number;
      ticket_type: { id: string; name: string; unit_noun: string | null };
      holder: { id: string; phone: string | null } | null;
      order: {
        id: string;
        event_id: string;
        promoter_link_id: string | null;
        is_courtesy: boolean | null;
        guest_email: string | null;
        guest_phone: string | null;
        custom_field_answers: Record<string, string | string[] | boolean> | null;
        buyer: { id: string; email: string | null; phone: string | null };
        promoter_link: { id: string; code: string } | null;
      };
    };

    const rows = (ticketRows as unknown as TicketJoinRow[] | null) ?? [];

    // Transferencias completadas de estos tickets: el contacto de QUIEN PORTA la
    // entrada transferida es el WhatsApp al que se envió (`to_contact`), y el
    // Origen "Transferida de X" usa el nombre del emisor (from_profile). Una sola
    // consulta batch (por bloques de IDs) — las transferencias son raras, casi
    // siempre devuelve poco. Nos quedamos con la más reciente por ticket.
    type TransferRow = {
      ticket_id: string;
      to_contact: string | null;
      created_at: string;
      from: { full_name: string | null } | null;
    };
    const transferByTicket = new Map<string, { toContact: string | null; fromName: string | null }>();
    const transferredIds = rows.filter((t) => t.transfer_count > 0).map((t) => t.id);
    for (let i = 0; i < transferredIds.length; i += PAGE) {
      const chunk = transferredIds.slice(i, i + PAGE);
      const { data: tr } = await db
        .from("ticket_transfers")
        .select("ticket_id, to_contact, created_at, from:profiles!ticket_transfers_from_profile_fkey(full_name)")
        .in("ticket_id", chunk)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      for (const row of (tr as unknown as TransferRow[] | null) ?? []) {
        // El primero por ticket (ya viene desc por created_at) es el más reciente.
        if (!transferByTicket.has(row.ticket_id)) {
          transferByTicket.set(row.ticket_id, {
            toContact: row.to_contact,
            fromName: row.from?.full_name ?? null,
          });
        }
      }
    }

    const attendees: AttendeeRow[] = rows.map((t) => {
      const transfer = transferByTicket.get(t.id) ?? null;
      // El que porta no es el comprador: transferencia recibida, o acompañante de
      // box que se unió con su propia cuenta. En ambos su contacto es el del
      // holder, no el del comprador.
      const holderDiffersFromBuyer = t.current_holder !== t.order?.buyer?.id;
      // Contacto de quien porta: si difiere del comprador, el WhatsApp del
      // receptor (to_contact de la transferencia, o el phone de su cuenta). Si
      // no, el del comprador/anfitrión (guest_* o su profile). Un acompañante de
      // box sin cuenta (current_holder = anfitrión) cae al contacto del anfitrión.
      const contactPhone = holderDiffersFromBuyer
        ? (transfer?.toContact ?? t.holder?.phone ?? t.order?.guest_phone ?? t.order?.buyer?.phone ?? null)
        : (t.order?.guest_phone ?? t.order?.buyer?.phone ?? t.holder?.phone ?? null);
      return {
        ticketId: t.id,
        holderName: t.holder_name,
        // DNI completo descifrado para la hoja del organizador. Si no hay enc
        // (compras viejas), cae a "··"+last4 como pista, o vacío.
        holderDni:
          decryptDni(t.holder_dni_enc) ??
          (t.holder_dni_last4 ? `··${t.holder_dni_last4}` : null),
        ticketTypeName: t.ticket_type?.name ?? "",
        boxLabel: t.box_label,
        unitNoun: t.ticket_type?.unit_noun ?? null,
        boxHostTicketId: t.box_host_ticket_id,
        status: t.status,
        usedAt: t.used_at,
        orderId: t.order_id,
        contactPhone,
        contactEmail: t.order?.guest_email ?? t.order?.buyer?.email ?? null,
        promoterCode: t.order?.promoter_link?.code ?? null,
        isCourtesy: t.order?.is_courtesy ?? false,
        transferFromName: transfer?.fromName ?? null,
        customFieldAnswers: t.order?.custom_field_answers ?? {},
      };
    });

    const summary = await this.getStats(eventId);

    // Use payoutCents already resolved by getStats (handles percentage/tiered/inkind).
    // payout = comisión por venta + hitos cash → la parte de venta es la resta.
    const promoters: PromoterReportRow[] = summary.byPromoter.map((p) => ({
      name: p.name,
      code: p.code,
      ticketsSold: p.ticketsSold,
      ticketsValidated: p.ticketsValidated,
      revenueCents: p.revenueCents,
      commissionPct: p.commissionPct,
      saleCommissionCents: p.payoutCents - p.milestoneCashCents,
      milestoneCashCents: p.milestoneCashCents,
      commissionCalculatedCents: p.payoutCents,
      hasMilestones: p.hasMilestones,
      milestoneBasis: p.milestoneBasis,
      milestoneCount: p.milestoneCount,
      milestones: p.milestones,
      unlockedRewards: p.unlockedRewards.map((r) => r.label),
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

import { z } from "zod";
import { headers } from "next/headers";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext, resolveActiveOrgSlug } from "@/server/_shared/AuthContext";
import { supabaseEventRepository as repo } from "../../infrastructure/repositories/SupabaseEventRepository";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { listPublishedEvents } from "../../application/ListPublishedEvents";
import { getEventBySlug } from "../../application/GetEventBySlug";
import { getEventAvailability } from "../../application/GetEventAvailability";
import { listEventsByOrganization } from "../../application/ListEventsByOrganization";
import { createEvent } from "../../application/CreateEvent";
import { getEventStats, type EventStatsResult } from "../../application/GetEventStats";
import { listEventAccesos } from "../../application/ListEventAccesos";
import { updateEvent } from "../../application/UpdateEvent";
import { generateDoorLink, type DoorLink } from "../../application/GenerateDoorLink";
import { verifyScanAccess } from "@/server/scanning/application/VerifyScanAccess";
import {
  resolveZoneScanPolicy,
  type ZoneScanPolicy,
} from "@/server/scanning/application/ZonePolicy";
import {
  listZones as listZonesSvc,
  createZone as createZoneSvc,
  updateZone as updateZoneSvc,
  deleteZone as deleteZoneSvc,
} from "../../application/ManageZones";
import type { Zone } from "../../domain/Zone";
import { exportEventReport } from "../../application/ExportEventReport";
import {
  getEventOrgShowcase,
  type EventOrgShowcase,
} from "../../application/GetEventOrgShowcase";
import {
  createTicketType,
  deleteTicketType,
  updateTicketType,
} from "../../application/ManageTicketTypes";
import {
  addEventCoOrganizer,
  listEventCoOrganizers,
  removeEventCoOrganizer,
  type EventCoOrganizer,
} from "../../application/EventCoOrganizers";
import {
  addEventPartner,
  listEventPartners,
  removeEventPartner,
  type EventPartner,
} from "../../application/EventPartners";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { getOrCreateEventSigningKeys } from "@/server/tickets/application/EventSigningKeys";
import {
  issueCourtesy as issueCourtesyUc,
  listCourtesies as listCourtesiesUc,
} from "@/server/tickets/application/Courtesies";
import { supabaseTicketRepository as ticketRepo } from "@/server/tickets/infrastructure/repositories/SupabaseTicketRepository";
import type { CourtesySummary } from "@/server/tickets/ports/TicketRepository";
import type { Event, EventCategory, Promo, TicketType } from "../../domain/Event";
import type { EventStats, ScanFeedItem } from "../../ports/EventRepository";

const sanitizeHost = (raw: string): string => {
  let h = raw.trim();
  if (h.startsWith("http://")) h = h.slice("http://".length);
  else if (h.startsWith("https://")) h = h.slice("https://".length);
  const slashAt = h.indexOf("/");
  if (slashAt > -1) h = h.slice(0, slashAt);
  return h || "pasape.lat";
};

const resolveOriginFromHeaders = async (): Promise<string> => {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const h = await headers();
  const host = sanitizeHost(h.get("x-forwarded-host") ?? h.get("host") ?? "pasape.lat");
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
};

type ResolvedOrgCtx = { profileId: string; orgId: string; orgSlug: string };

// `allowedRoles` (opcional): si se pasa, exige que el caller tenga ese rol en la
// org activa. Sin él, basta con ser miembro (para lecturas como listMine). Las
// operaciones de escritura DEBEN pasar allowedRoles — ser miembro no alcanza:
// un reporter/door no debe crear ni publicar eventos.
const resolveOrgCtx = async (
  allowedRoles?: string[],
): Promise<Result<ResolvedOrgCtx>> => {
  const auth = await getAuthContext();
  if (!auth.ok) return err(auth.error);
  const slug = await resolveActiveOrgSlug(auth.value.profileId);
  if (!slug) return err("no_active_org");
  const org = await supabaseOrganizationRepository.findBySlug(slug);
  if (!org) return err("no_active_org");
  if (allowedRoles) {
    const { data: membership } = await supabaseAdmin()
      .from("memberships")
      .select("role")
      .eq("scope_type", "organization")
      .eq("scope_id", org.id)
      .eq("profile_id", auth.value.profileId)
      .maybeSingle<{ role: string }>();
    if (!membership || !allowedRoles.includes(membership.role)) return err("forbidden");
  }
  return ok({ profileId: auth.value.profileId, orgId: org.id, orgSlug: slug });
};

const ORG_WRITE_ROLES = ["owner", "admin", "editor"];

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  venueLat: z.number().min(-90).max(90).nullable().optional(),
  venueLng: z.number().min(-180).max(180).nullable().optional(),
  venueUrl: z.string().url().nullable().optional(),
  venueSource: z.enum(["manual", "google", "apple"]).nullable().optional(),
  venueLayoutUrl: z.string().url().nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  paletteDark: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  paletteMid: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  paletteAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().nullable().optional(),
  timezone: z.string().default("America/Lima"),
  category: z.enum(["conciertos","fiestas","festivales","comedia","cultura","deportes"]).nullable().optional(),
  totalCapacity: z.number().int().nullable().optional(),
  overbookPct: z.number().int().min(0).max(100).default(0),
  maxTicketsPerPerson: z.number().int().positive().nullable().optional(),
  transfersEnabled: z.boolean().default(true),
  transferDeadlineHours: z.number().int().nullable().optional(),
  transferMaxCount: z.number().int().min(0).default(1),
  transferRequiresKyc: z.boolean().default(false),
  feeMode: z.enum(["buyer_pays_extra", "included_in_price"]).optional(),
  ticketTypes: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.enum(["general", "box"]).default("general"),
        priceCents: z.number().int().min(0),
        capacity: z.number().int().min(0),
        boxLabel: z.string().trim().min(1).max(40).nullable().optional(),
        unitNoun: z.string().trim().max(24).nullable().optional(),
        saleEndsAt: z.string().datetime().nullable().optional(),
        presalePriceCents: z.number().int().min(0).nullable().optional(),
        presaleQty: z.number().int().min(0).nullable().optional(),
        presaleEndsAt: z.string().datetime().nullable().optional(),
        isFree: z.boolean().optional(),
        freeUntilAt: z.string().datetime().nullable().optional(),
      }),
    )
    .min(1),
});

export const EventsController = {
  async listPublic(opts: { limit?: number; cursor?: string | null; category?: EventCategory | null } = {}): Promise<Result<Event[]>> {
    const events = await listPublishedEvents({ repo }, opts);
    return ok(events);
  },

  async getBySlug(
    slug: string,
  ): Promise<Result<{ event: Event; ticketTypes: TicketType[]; promos: Promo[] }>> {
    const data = await getEventBySlug({ repo }, slug);
    if (!data) return err("not_found");
    // Published y closed son públicos: un evento que terminó sigue siendo
    // visible (se muestra como "terminado"), no un 404. Draft y cancelled
    // sólo los ve un miembro de la org dueña (preview interno).
    if (data.event.status !== "published" && data.event.status !== "closed") {
      const auth = await getAuthContext();
      if (!auth.ok) return err("not_found");
      const { data: membership } = await supabaseAdmin()
        .from("memberships")
        .select("role")
        .eq("scope_type", "organization")
        .eq("scope_id", data.event.organizationId)
        .eq("profile_id", auth.value.profileId)
        .maybeSingle<{ role: string }>();
      if (!membership) return err("not_found");
    }
    return { ok: true, value: data };
  },

  async availability(slug: string) {
    return getEventAvailability(slug);
  },

  async listMine(): Promise<Result<Event[]>> {
    const ctx = await resolveOrgCtx();
    if (!ctx.ok) return err(ctx.error);
    return { ok: true, value: await listEventsByOrganization({ repo }, ctx.value.orgId) };
  },

  async create(input: unknown): Promise<Result<Event>> {
    const ctx = await resolveOrgCtx(ORG_WRITE_ROLES);
    if (!ctx.ok) return err(ctx.error);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");

    return createEvent(
      { repo },
      {
        organizationId: ctx.value.orgId,
        createdBy: ctx.value.profileId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        venue: parsed.data.venue ?? null,
        venueLat: parsed.data.venueLat ?? null,
        venueLng: parsed.data.venueLng ?? null,
        venueUrl: parsed.data.venueUrl ?? null,
        venueSource: parsed.data.venueSource ?? null,
        venueLayoutUrl: parsed.data.venueLayoutUrl ?? null,
        coverUrl: parsed.data.coverUrl ?? null,
        paletteDark: parsed.data.paletteDark ?? null,
        paletteMid: parsed.data.paletteMid ?? null,
        paletteAccent: parsed.data.paletteAccent ?? null,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt ?? null,
        timezone: parsed.data.timezone,
        category: parsed.data.category ?? null,
        totalCapacity: parsed.data.totalCapacity ?? null,
        overbookPct: parsed.data.overbookPct,
        maxTicketsPerPerson: parsed.data.maxTicketsPerPerson ?? null,
        transfersEnabled: parsed.data.transfersEnabled,
        transferDeadlineHours: parsed.data.transferDeadlineHours ?? null,
        transferMaxCount: parsed.data.transferMaxCount,
        transferRequiresKyc: parsed.data.transferRequiresKyc,
        feeMode: parsed.data.feeMode,
        ticketTypes: parsed.data.ticketTypes,
      },
    );
  },

  async publish(eventId: string): Promise<Result<Event>> {
    const ctx = await resolveOrgCtx(ORG_WRITE_ROLES);
    if (!ctx.ok) return err(ctx.error);
    return repo.publish(eventId, ctx.value.orgId);
  },

  async publishBySlug(slug: string): Promise<Result<Event>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    return repo.publish(guard.value.event.id, guard.value.event.organizationId);
  },

  async stats(slug: string): Promise<Result<EventStatsResult>> {
    const guard = await guardScanReader(slug);
    if (!guard.ok) return err(guard.error);
    return ok(await getEventStats({ repo }, guard.value.eventId));
  },

  async accesos(slug: string): Promise<Result<ScanFeedItem[]>> {
    const guard = await guardEventMember(slug);
    if (!guard.ok) return err(guard.error);
    return ok(await listEventAccesos({ repo }, guard.value.event.id, 50));
  },

  async update(slug: string, input: unknown): Promise<Result<Event>> {
    const guard = await guardEventMember(slug, ORG_WRITE_ROLES);
    if (!guard.ok) return err(guard.error);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return updateEvent({ repo }, guard.value.event.id, guard.value.event.organizationId, parsed.data);
  },

  async doorLink(slug: string): Promise<Result<DoorLink>> {
    // Acuñar el link de puerta es una acción sensible (enrola porteros con
    // acceso de escaneo), no una simple lectura de miembro: requiere rol de
    // gestión igual que crear zonas o publicar (LOW-3).
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    const origin = await resolveOriginFromHeaders();
    return ok(await generateDoorLink(guard.value.event, origin));
  },

  // ── Puertas (zonas) ───────────────────────────────────────────────────────
  async listZones(slug: string): Promise<Result<Zone[]>> {
    const guard = await guardEventMember(slug);
    if (!guard.ok) return err(guard.error);
    return ok(await listZonesSvc(guard.value.event.id));
  },

  async createZone(slug: string, input: unknown): Promise<Result<Zone>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    const parsed = createZoneSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return createZoneSvc(guard.value.event.id, {
      name: parsed.data.name,
      ticketTypeIds: parsed.data.ticketTypeIds,
      isDefault: parsed.data.isDefault,
    });
  },

  async updateZone(
    slug: string,
    zoneId: string,
    input: unknown,
  ): Promise<Result<Zone>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    const parsed = updateZoneSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return updateZoneSvc(guard.value.event.id, zoneId, parsed.data);
  },

  async deleteZone(slug: string, zoneId: string): Promise<Result<{ id: string }>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    return deleteZoneSvc(guard.value.event.id, zoneId);
  },

  async listByOrgSlug(slug: string): Promise<Result<Event[]>> {
    return ok(await repo.listByOrgSlug(slug));
  },

  async createTicketType(slug: string, input: unknown): Promise<Result<TicketType>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    const parsed = createTicketTypeSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return createTicketType({ repo }, guard.value.event.id, {
      name: parsed.data.name,
      kind: parsed.data.kind,
      priceCents: parsed.data.priceCents,
      capacity: parsed.data.capacity,
      boxLabel: parsed.data.boxLabel ?? null,
      unitNoun: parsed.data.unitNoun ?? null,
      saleEndsAt: parsed.data.saleEndsAt ?? null,
      description: parsed.data.description ?? null,
      presaleTiers: parsed.data.presaleTiers,
      presalePriceCents: parsed.data.presalePriceCents ?? null,
      presaleQty: parsed.data.presaleQty ?? null,
      presaleEndsAt: parsed.data.presaleEndsAt ?? null,
      isFree: parsed.data.isFree ?? false,
      freeUntilAt: parsed.data.freeUntilAt ?? null,
    });
  },

  async setPromos(slug: string, input: unknown): Promise<Result<Promo[]>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    const parsed = setPromosSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return repo.setPromos(guard.value.event.id, parsed.data.promos);
  },

  async listPromos(slug: string): Promise<Result<Promo[]>> {
    const found = await repo.getBySlug(slug);
    if (!found) return err("event_not_found");
    return ok(found.promos);
  },

  async updateTicketType(
    slug: string,
    ticketTypeId: string,
    input: unknown,
  ): Promise<Result<TicketType>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    const parsed = updateTicketTypeSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return updateTicketType({ repo }, guard.value.event.id, ticketTypeId, parsed.data);
  },

  async deleteTicketType(slug: string, ticketTypeId: string): Promise<Result<{ id: string }>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    return deleteTicketType({ repo }, guard.value.event.id, ticketTypeId);
  },

  async exportXlsx(
    slug: string,
  ): Promise<Result<{ buffer: Buffer; filename: string }>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    return ok(await exportEventReport({ repo }, guard.value.event));
  },

  async listCoOrganizers(slug: string): Promise<Result<EventCoOrganizer[]>> {
    const guard = await guardEventMember(slug);
    if (!guard.ok) return err(guard.error);
    return ok(await listEventCoOrganizers(guard.value.event.id));
  },

  async addCoOrganizer(
    slug: string,
    input: unknown,
  ): Promise<Result<{ profileId: string }>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    const parsed = z.object({ profileId: z.string().uuid() }).safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return addEventCoOrganizer(guard.value.event.id, parsed.data.profileId);
  },

  async removeCoOrganizer(
    slug: string,
    profileId: string,
  ): Promise<Result<{ profileId: string }>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    return removeEventCoOrganizer(guard.value.event.id, profileId);
  },

  async getScanCache(slug: string, since?: string | null): Promise<Result<{
    eventId: string;
    fetchedAt: string;
    /** true = snapshot completo (reemplazar cache); false = delta (merge). */
    full: boolean;
    zonePolicy: ZoneScanPolicy;
    tickets: Array<{
      ticketId: string;
      ticketTypeId: string;
      qrCode: string;
      holderName: string | null;
      holderDniLast4: string | null;
      ticketTypeName: string;
      boxLabel: string | null;
      boxHostTicketId: string | null;
      status: "active" | "used" | "void" | "refunded";
      signingPub: JsonWebKey | null;
      boxCapacity: number | null;
    }>;
  }>> {
    const access = await verifyScanAccess(slug);
    if (!access.ok) return err(access.error);
    const eventId = access.value.eventId;
    const zonePolicy = await resolveZoneScanPolicy(eventId, access.value.zoneId);
    const db = supabaseAdmin();
    // Cursor: timestamp ANTES de la query, para que el próximo delta no se pierda
    // cambios ocurridos durante la consulta.
    const fetchedAt = new Date().toISOString();
    let q = db
      .from("tickets")
      .select(`
        id,
        qr_code,
        holder_name,
        holder_dni_last4,
        status,
        box_label,
        box_host_ticket_id,
        signing_pub,
        orders!inner(event_id),
        ticket_types!inner(id, name, capacity)
      `)
      .eq("orders.event_id", eventId);
    // Delta: TODO lo cambiado desde `since` (incl. void/refunded, para que el
    // portero los borre del cache). Full: solo activas/usadas (snapshot inicial).
    q = since ? q.gt("updated_at", since) : q.in("status", ["active", "used"]);
    const { data, error } = await q
      .returns<Array<{
        id: string;
        qr_code: string;
        holder_name: string | null;
        holder_dni_last4: string | null;
        status: "active" | "used" | "void" | "refunded";
        box_label: string | null;
        box_host_ticket_id: string | null;
        signing_pub: JsonWebKey | null;
        orders: { event_id: string };
        ticket_types: { id: string; name: string; capacity: number };
      }>>();

    if (error) return err("database_error");
    if (!data) return err("database_error");

    return ok({
      eventId,
      fetchedAt,
      full: !since,
      zonePolicy,
      tickets: data.map((t) => ({
        ticketId: t.id,
        ticketTypeId: t.ticket_types.id,
        qrCode: t.qr_code,
        holderName: t.holder_name,
        holderDniLast4: t.holder_dni_last4,
        ticketTypeName: t.ticket_types.name,
        boxLabel: t.box_label,
        boxHostTicketId: t.box_host_ticket_id,
        status: t.status,
        signingPub: t.signing_pub,
        // Solo relevante para box: aforo (asientos). El portero lo usa para "X/Y".
        boxCapacity: t.box_label ? t.ticket_types.capacity : null,
      })),
    });
  },

  // Sirve la pública ECDSA del evento al portero (la cachea para verificar QR
  // firmados offline). Genera el par perezosamente si aún no existe.
  async getEventSigningKey(
    slug: string,
  ): Promise<Result<{ eventId: string; publicKey: unknown }>> {
    const guard = await guardScanReader(slug);
    if (!guard.ok) return err(guard.error);
    const db = supabaseAdmin();
    const keys = await getOrCreateEventSigningKeys(db, guard.value.eventId);
    return ok({ eventId: guard.value.eventId, publicKey: keys.publicJwk });
  },

  async listCourtesies(slug: string): Promise<Result<CourtesySummary[]>> {
    // PII de invitados: solo roles que pueden emitir cortesías (no reporter/door).
    const guard = await guardEventMember(slug, ORG_WRITE_ROLES);
    if (!guard.ok) return err(guard.error);
    return listCourtesiesUc({ repo: ticketRepo }, guard.value.event.id);
  },

  async sendCourtesy(slug: string, input: unknown): Promise<Result<{ orderId: string }>> {
    const guard = await guardEventMember(slug, ORG_WRITE_ROLES);
    if (!guard.ok) return err(guard.error);
    const parsed = z
      .object({
        ticketTypeId: z.string().uuid(),
        qty: z.number().int().min(1).max(10).default(1),
        guest: z
          .object({
            fullName: z.string().trim().min(2).max(120),
            email: z.string().trim().email().nullable().optional(),
            phone: z.string().trim().min(6).max(20).nullable().optional(),
          })
          .refine((g) => !!g.email || !!g.phone, { message: "contact_required" }),
      })
      .safeParse(input);
    if (!parsed.success) return err("invalid_input");
    // El tipo debe pertenecer a este evento — priceOrder lo re-valida igual
    // (event_mismatch), acá solo damos un error temprano más claro.
    if (!guard.value.ticketTypes.some((tt) => tt.id === parsed.data.ticketTypeId)) {
      return err("ticket_type_missing");
    }
    const sent = await issueCourtesyUc(
      { repo: ticketRepo },
      { eventId: guard.value.event.id, ...parsed.data },
    );
    if (!sent.ok) return err(sent.error);
    return ok({ orderId: sent.value.order.id });
  },

  async listPartners(slug: string): Promise<Result<EventPartner[]>> {
    const found = await getEventBySlug({ repo }, slug);
    if (!found) return err("not_found");
    return ok(await listEventPartners(found.event.id));
  },

  async addPartner(slug: string, input: unknown): Promise<Result<EventPartner>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    const parsed = z
      .object({
        name: z.string().min(1).max(120),
        logoUrl: z.string().url().nullable().optional(),
        websiteUrl: z.string().url().nullable().optional(),
      })
      .safeParse(input);
    if (!parsed.success) return err("invalid_input");
    const partner = await addEventPartner(guard.value.event.id, parsed.data);
    return ok(partner);
  },

  async removePartner(slug: string, partnerId: string): Promise<Result<null>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    await removeEventPartner(partnerId, guard.value.event.id);
    return ok(null);
  },

  // Cross-sell público: productora del evento + sus otros eventos próximos.
  async getOrgShowcase(
    slug: string,
  ): Promise<Result<EventOrgShowcase | null>> {
    const showcase = await getEventOrgShowcase(slug);
    return ok(showcase);
  },
};

const presaleFields = {
  presalePriceCents: z.number().int().min(0).nullable().optional(),
  presaleQty: z.number().int().min(0).nullable().optional(),
  presaleEndsAt: z.string().datetime().nullable().optional(),
  isFree: z.boolean().optional(),
  freeUntilAt: z.string().datetime().nullable().optional(),
};

const createTicketTypeSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["general", "box"]).default("general"),
  priceCents: z.number().int().min(0),
  capacity: z.number().int().min(0),
  boxLabel: z.string().trim().min(1).max(40).nullable().optional(),
  unitNoun: z.string().trim().max(24).nullable().optional(),
  saleEndsAt: z.string().datetime().nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  presaleTiers: z.array(z.object({
    priceCents: z.number().int().min(0),
    endsAt: z.string().datetime(),
  })).max(10).optional(),
  ...presaleFields,
});

const updateTicketTypeSchema = z.object({
  name: z.string().min(1).optional(),
  priceCents: z.number().int().min(0).optional(),
  capacity: z.number().int().min(0).optional(),
  boxLabel: z.string().trim().min(1).max(40).nullable().optional(),
  unitNoun: z.string().trim().max(24).nullable().optional(),
  saleEndsAt: z.string().datetime().nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  presaleTiers: z.array(z.object({
    priceCents: z.number().int().min(0),
    endsAt: z.string().datetime(),
  })).max(10).optional(),
  ...presaleFields,
});

const setPromosSchema = z.object({
  promos: z
    .array(
      z.object({
        ticketTypeId: z.string().uuid(),
        kind: z.enum(["2x1", "3x2"]),
        endsAt: z.string().datetime().nullable().optional(),
      }),
    )
    .max(100),
});

const createZoneSchema = z.object({
  name: z.string().min(1),
  ticketTypeIds: z.array(z.string().uuid()).max(100).default([]),
  // true = recrear la puerta principal (valida todas). Solo puede haber una.
  isDefault: z.boolean().optional(),
});

const updateZoneSchema = z.object({
  name: z.string().min(1).optional(),
  ticketTypeIds: z.array(z.string().uuid()).max(100).optional(),
});

const updateSchema = z.object({
  status: z.enum(["draft", "published", "closed", "cancelled"]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  venueLat: z.number().nullable().optional(),
  venueLng: z.number().nullable().optional(),
  venueUrl: z.string().nullable().optional(),
  venueSource: z.enum(["manual", "google", "apple"]).nullable().optional(),
  venueLayoutUrl: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  paletteDark: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  paletteMid: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  paletteAccent: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().nullable().optional(),
  category: z.enum(["conciertos","fiestas","festivales","comedia","cultura","deportes"]).nullable().optional(),
  totalCapacity: z.number().int().nullable().optional(),
  overbookPct: z.number().int().min(0).max(100).optional(),
  maxTicketsPerPerson: z.number().int().positive().nullable().optional(),
  transfersEnabled: z.boolean().optional(),
  transferDeadlineHours: z.number().int().nullable().optional(),
  transferMaxCount: z.number().int().min(0).optional(),
  transferRequiresKyc: z.boolean().optional(),
  feeMode: z.enum(["buyer_pays_extra", "included_in_price"]).optional(),
});

async function guardEventMember(
  slug: string,
  allowedRoles?: string[],
): Promise<Result<{ event: Event; ticketTypes: TicketType[] }>> {
  const auth = await getAuthContext();
  if (!auth.ok) return err(auth.error);
  const detail = await getEventBySlug({ repo }, slug);
  if (!detail) return err("not_found");
  // Verify the caller is a member of the event's organization.
  const db = supabaseAdmin();
  const { data: membership } = await db
    .from("memberships")
    .select("role")
    .eq("scope_type", "organization")
    .eq("scope_id", detail.event.organizationId)
    .eq("profile_id", auth.value.profileId)
    .maybeSingle<{ role: string }>();
  if (!membership) return err("forbidden");
  if (allowedRoles && !allowedRoles.includes(membership.role)) return err("forbidden");
  return ok(detail);
}

// Lectura de datos de escaneo (cache, clave pública, stats): la consume tanto el
// miembro de la org (dashboard) como el portero por código. Delega en
// verifyScanAccess, que resuelve ambos caminos (membership o x-door-token).
async function guardScanReader(
  slug: string,
): Promise<Result<{ eventId: string }>> {
  const access = await verifyScanAccess(slug);
  if (!access.ok) return err(access.error);
  return ok({ eventId: access.value.eventId });
}

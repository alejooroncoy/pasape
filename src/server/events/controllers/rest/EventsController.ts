import { z } from "zod";
import { headers } from "next/headers";
import { err, ok, type Result } from "@/server/_shared/result";
import { getAuthContext, resolveActiveOrgSlug } from "@/server/_shared/AuthContext";
import { supabaseEventRepository as repo } from "../../infrastructure/repositories/SupabaseEventRepository";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { listPublishedEvents } from "../../application/ListPublishedEvents";
import { getEventBySlug } from "../../application/GetEventBySlug";
import { listEventsByOrganization } from "../../application/ListEventsByOrganization";
import { createEvent } from "../../application/CreateEvent";
import { getEventStats, type EventStatsResult } from "../../application/GetEventStats";
import { listEventAccesos } from "../../application/ListEventAccesos";
import { updateEvent } from "../../application/UpdateEvent";
import { generateDoorLink, type DoorLink } from "../../application/GenerateDoorLink";
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

const resolveOrgCtx = async (): Promise<Result<ResolvedOrgCtx>> => {
  const auth = await getAuthContext();
  if (!auth.ok) return err(auth.error);
  const slug = await resolveActiveOrgSlug(auth.value.profileId);
  if (!slug) return err("no_active_org");
  const org = await supabaseOrganizationRepository.findBySlug(slug);
  if (!org) return err("no_active_org");
  return ok({ profileId: auth.value.profileId, orgId: org.id, orgSlug: slug });
};

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  venueLat: z.number().min(-90).max(90).nullable().optional(),
  venueLng: z.number().min(-180).max(180).nullable().optional(),
  venueUrl: z.string().url().nullable().optional(),
  venueSource: z.enum(["manual", "google", "apple"]).nullable().optional(),
  venueLayoutUrl: z.string().url().nullable().optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().nullable().optional(),
  timezone: z.string().default("America/Lima"),
  category: z.enum(["conciertos","fiestas","festivales","comedia","cultura","deportes"]).nullable().optional(),
  totalCapacity: z.number().int().nullable().optional(),
  overbookPct: z.number().int().min(0).max(100).default(0),
  transfersEnabled: z.boolean().default(true),
  transferDeadlineHours: z.number().int().nullable().optional(),
  transferMaxCount: z.number().int().min(0).default(1),
  transferRequiresKyc: z.boolean().default(false),
  ticketTypes: z
    .array(
      z.object({
        name: z.string().min(1),
        kind: z.enum(["general", "vip", "box"]).default("general"),
        priceCents: z.number().int().min(0),
        capacity: z.number().int().min(0),
        boxLabel: z.string().trim().min(1).max(40).nullable().optional(),
        zone: z.string().trim().max(60).nullable().optional(),
        unitNoun: z.string().trim().max(24).nullable().optional(),
        saleEndsAt: z.string().datetime().nullable().optional(),
        presalePriceCents: z.number().int().min(0).nullable().optional(),
        presaleQty: z.number().int().min(0).nullable().optional(),
        presaleEndsAt: z.string().datetime().nullable().optional(),
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
    // Si el evento está publicado, acceso libre. Si está en draft/closed/
    // cancelled, sólo lo ve un miembro de la org dueña (preview interno).
    if (data.event.status !== "published") {
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

  async listMine(): Promise<Result<Event[]>> {
    const ctx = await resolveOrgCtx();
    if (!ctx.ok) return err(ctx.error);
    return { ok: true, value: await listEventsByOrganization({ repo }, ctx.value.orgId) };
  },

  async create(input: unknown): Promise<Result<Event>> {
    const ctx = await resolveOrgCtx();
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
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt ?? null,
        timezone: parsed.data.timezone,
        category: parsed.data.category ?? null,
        totalCapacity: parsed.data.totalCapacity ?? null,
        overbookPct: parsed.data.overbookPct,
        transfersEnabled: parsed.data.transfersEnabled,
        transferDeadlineHours: parsed.data.transferDeadlineHours ?? null,
        transferMaxCount: parsed.data.transferMaxCount,
        transferRequiresKyc: parsed.data.transferRequiresKyc,
        ticketTypes: parsed.data.ticketTypes,
      },
    );
  },

  async publish(eventId: string): Promise<Result<Event>> {
    const ctx = await resolveOrgCtx();
    if (!ctx.ok) return err(ctx.error);
    return repo.publish(eventId, ctx.value.orgId);
  },

  async publishBySlug(slug: string): Promise<Result<Event>> {
    const guard = await guardEventMember(slug, ["owner", "admin", "editor"]);
    if (!guard.ok) return err(guard.error);
    return repo.publish(guard.value.event.id, guard.value.event.organizationId);
  },

  async stats(slug: string): Promise<Result<EventStatsResult>> {
    const guard = await guardEventMember(slug);
    if (!guard.ok) return err(guard.error);
    return ok(await getEventStats({ repo }, guard.value.event.id));
  },

  async accesos(slug: string): Promise<Result<ScanFeedItem[]>> {
    const guard = await guardEventMember(slug);
    if (!guard.ok) return err(guard.error);
    return ok(await listEventAccesos({ repo }, guard.value.event.id, 50));
  },

  async update(slug: string, input: unknown): Promise<Result<Event>> {
    const guard = await guardEventMember(slug);
    if (!guard.ok) return err(guard.error);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "invalid_input");
    return updateEvent({ repo }, guard.value.event.id, guard.value.event.organizationId, parsed.data);
  },

  async doorLink(slug: string): Promise<Result<DoorLink>> {
    const guard = await guardEventMember(slug);
    if (!guard.ok) return err(guard.error);
    const origin = await resolveOriginFromHeaders();
    return ok(generateDoorLink(guard.value.event, origin));
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
      zone: parsed.data.zone ?? null,
      unitNoun: parsed.data.unitNoun ?? null,
      saleEndsAt: parsed.data.saleEndsAt ?? null,
      description: parsed.data.description ?? null,
      presaleTiers: parsed.data.presaleTiers,
      presalePriceCents: parsed.data.presalePriceCents ?? null,
      presaleQty: parsed.data.presaleQty ?? null,
      presaleEndsAt: parsed.data.presaleEndsAt ?? null,
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

  async getScanCache(slug: string): Promise<Result<{
    eventId: string;
    fetchedAt: string;
    tickets: Array<{
      ticketId: string;
      qrCode: string;
      holderName: string | null;
      holderDniLast2: string | null;
      ticketTypeName: string;
      boxLabel: string | null;
      boxHostTicketId: string | null;
      status: "active" | "used" | "void" | "refunded";
      signingPub: JsonWebKey | null;
    }>;
  }>> {
    const guard = await guardEventMember(slug);
    if (!guard.ok) return err(guard.error);
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("tickets")
      .select(`
        id,
        qr_code,
        holder_name,
        holder_dni_last2,
        status,
        box_label,
        box_host_ticket_id,
        signing_pub,
        orders!inner(event_id),
        ticket_types!inner(name)
      `)
      .eq("orders.event_id", guard.value.event.id)
      .in("status", ["active", "used"])
      .returns<Array<{
        id: string;
        qr_code: string;
        holder_name: string | null;
        holder_dni_last2: string | null;
        status: "active" | "used" | "void" | "refunded";
        box_label: string | null;
        box_host_ticket_id: string | null;
        signing_pub: JsonWebKey | null;
        orders: { event_id: string };
        ticket_types: { name: string };
      }>>();

    if (error) return err("database_error");
    if (!data) return err("database_error");

    return ok({
      eventId: guard.value.event.id,
      fetchedAt: new Date().toISOString(),
      tickets: data.map((t) => ({
        ticketId: t.id,
        qrCode: t.qr_code,
        holderName: t.holder_name,
        holderDniLast2: t.holder_dni_last2,
        ticketTypeName: t.ticket_types.name,
        boxLabel: t.box_label,
        boxHostTicketId: t.box_host_ticket_id,
        status: t.status,
        signingPub: t.signing_pub,
      })),
    });
  },

  // Sirve la pública ECDSA del evento al portero (la cachea para verificar QR
  // firmados offline). Genera el par perezosamente si aún no existe.
  async getEventSigningKey(
    slug: string,
  ): Promise<Result<{ eventId: string; publicKey: unknown }>> {
    const guard = await guardEventMember(slug);
    if (!guard.ok) return err(guard.error);
    const db = supabaseAdmin();
    const keys = await getOrCreateEventSigningKeys(db, guard.value.event.id);
    return ok({ eventId: guard.value.event.id, publicKey: keys.publicJwk });
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
};

const createTicketTypeSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["general", "vip", "box"]).default("general"),
  priceCents: z.number().int().min(0),
  capacity: z.number().int().min(0),
  boxLabel: z.string().trim().min(1).max(40).nullable().optional(),
  zone: z.string().trim().max(60).nullable().optional(),
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
  zone: z.string().trim().max(60).nullable().optional(),
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
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().nullable().optional(),
  category: z.enum(["conciertos","fiestas","festivales","comedia","cultura","deportes"]).nullable().optional(),
  totalCapacity: z.number().int().nullable().optional(),
  overbookPct: z.number().int().min(0).max(100).optional(),
  transfersEnabled: z.boolean().optional(),
  transferDeadlineHours: z.number().int().nullable().optional(),
  transferMaxCount: z.number().int().min(0).optional(),
  transferRequiresKyc: z.boolean().optional(),
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

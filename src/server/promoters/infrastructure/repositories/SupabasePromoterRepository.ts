import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok } from "@/server/_shared/result";
import crypto from "node:crypto";
import type { PromoterRepository } from "@/server/promoters/ports/PromoterRepository";
import type {
  PromoterApplication,
  PromoterEventEarning,
  PromoterGuest,
  PromoterLink,
} from "@/server/promoters/domain/Promoter";

type LinkRow = {
  id: string;
  event_id: string;
  promoter_id: string | null;
  org_promoter_id: string | null;
  code: string;
  commission_pct: number;
  active: boolean;
  created_at: string;
  guest_list_quota: number | null;
  event: {
    id: string;
    slug: string;
    title: string;
    starts_at: string;
    venue: string | null;
    organization_id: string;
    status: string;
  };
};

const computeEventStatus = (
  startsAt: string,
  status: string,
  now: Date,
): "live" | "upcoming" | "closed" => {
  if (status === "closed" || status === "cancelled") return "closed";
  const diffMs = new Date(startsAt).getTime() - now.getTime();
  if (Math.abs(diffMs) <= 6 * 60 * 60 * 1000) return "live";
  return "upcoming";
};

const toLink = (r: LinkRow, now: Date = new Date()): PromoterLink => ({
  id: r.id,
  eventId: r.event_id,
  eventSlug: r.event.slug,
  eventTitle: r.event.title,
  eventStartsAt: r.event.starts_at,
  eventVenue: r.event.venue,
  promoterId: r.promoter_id,
  orgPromoterId: r.org_promoter_id,
  code: r.code,
  commissionPct: r.commission_pct,
  active: r.active,
  createdAt: r.created_at,
  guestListQuota: r.guest_list_quota ?? null,
  eventStatus: computeEventStatus(r.event.starts_at, r.event.status, now),
});

const slugCode = (full: string) =>
  full
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 30) || crypto.randomBytes(4).toString("hex");

export const supabasePromoterRepository: PromoterRepository = {
  async listMyLinks(promoterId) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("promoter_links")
      .select(
        "*, event:events!inner(id, slug, title, starts_at, venue, organization_id, status)",
      )
      .eq("promoter_id", promoterId)
      .order("created_at", { ascending: false });
    return (data as unknown as LinkRow[] | null)?.map((r) => toLink(r)) ?? [];
  },

  async getHomeData(promoterId, slug) {
    const db = supabaseAdmin();
    const { data: link } = await db
      .from("promoter_links")
      .select(
        "*, event:events!inner(id, slug, title, starts_at, venue, organization_id, status)",
      )
      .eq("promoter_id", promoterId)
      .eq("event.slug", slug)
      .maybeSingle();
    if (!link) return null;
    const l = toLink(link as unknown as LinkRow);

    // total_cents > 0 = venta real. Las cortesías (S/0 de la lista de invitados)
    // también quedan 'paid', así que se excluyen para no inflar "Vendidas" ni
    // aparecer como "compró" en la actividad.
    const { count } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("promoter_link_id", l.id)
      .eq("status", "paid")
      .gt("total_cents", 0);

    const { data: orders } = await db
      .from("orders")
      .select("created_at, buyer:profiles!inner(full_name)")
      .eq("promoter_link_id", l.id)
      .eq("status", "paid")
      .gt("total_cents", 0)
      .order("created_at", { ascending: false })
      .limit(10);

    type OrderRow = { created_at: string; buyer: { full_name: string | null } };
    const recent = ((orders as unknown as OrderRow[] | null) ?? []).map((o) => ({
      firstName: (o.buyer?.full_name ?? "Alguien").split(" ")[0] ?? "Alguien",
      createdAt: o.created_at,
    }));

    return { link: l, soldCount: count ?? 0, recent };
  },

  async listGuests(linkId): Promise<PromoterGuest[]> {
    const db = supabaseAdmin();
    const { data } = await db
      .from("tickets")
      .select(
        "id, holder_name, holder_email, holder_phone, status, used_at, created_at, " +
          "order:orders!inner(promoter_link_id)",
      )
      .eq("order.promoter_link_id", linkId)
      .eq("is_courtesy", true)
      .order("created_at", { ascending: false });

    type GuestTicketRow = {
      id: string;
      holder_name: string | null;
      holder_email: string | null;
      holder_phone: string | null;
      status: PromoterGuest["status"];
      used_at: string | null;
      created_at: string;
    };
    return ((data as unknown as GuestTicketRow[] | null) ?? []).map((t) => ({
      ticketId: t.id,
      name: t.holder_name,
      email: t.holder_email,
      phone: t.holder_phone,
      status: t.status,
      enteredAt: t.used_at,
      createdAt: t.created_at,
    }));
  },

  async countCourtesies(linkId): Promise<number> {
    const db = supabaseAdmin();
    // Mismo criterio que el cupo del evento: solo cortesías vigentes (active/used).
    const { count } = await db
      .from("tickets")
      .select("id, order:orders!inner(promoter_link_id)", { count: "exact", head: true })
      .eq("order.promoter_link_id", linkId)
      .eq("is_courtesy", true)
      .in("status", ["active", "used"]);
    return count ?? 0;
  },

  async getEarnings(promoterId) {
    const db = supabaseAdmin();
    const { data: links } = await db
      .from("promoter_links")
      .select(
        "id, commission_pct, event:events!inner(id, slug, title, starts_at)",
      )
      .eq("promoter_id", promoterId);
    type LL = {
      id: string;
      commission_pct: number;
      event: { id: string; slug: string; title: string; starts_at: string };
    };
    const list = ((links as unknown as LL[] | null) ?? []);
    const out: PromoterEventEarning[] = [];
    for (const l of list) {
      const { data: orders } = await db
        .from("orders")
        .select("total_cents")
        .eq("promoter_link_id", l.id)
        .eq("status", "paid");
      const orderRows = (orders as Array<{ total_cents: number }> | null) ?? [];
      const gross = orderRows.reduce((a, o) => a + o.total_cents, 0);
      const sold = orderRows.length;

      // Use unlocked tiers if they exist for this link; fall back to percentage.
      const { data: tiers } = await db
        .from("commission_tiers")
        .select("reward_amount_cents, threshold_count")
        .eq("promoter_link_id", l.id)
        .not("unlocked_at", "is", null);
      type TierRow = { reward_amount_cents: number | null; threshold_count: number };
      const tierRows = (tiers as TierRow[] | null) ?? [];
      const commission =
        tierRows.length > 0
          ? tierRows.reduce((a, t) => a + (t.reward_amount_cents ?? 0), 0)
          : Math.round((gross * l.commission_pct) / 100);

      const { data: payout } = await db
        .from("payouts")
        .select("status")
        .eq("promoter_id", promoterId)
        .eq("event_id", l.event.id)
        .maybeSingle<{ status: "pending" | "paid" | "void" }>();

      out.push({
        eventId: l.event.id,
        eventSlug: l.event.slug,
        eventTitle: l.event.title,
        eventStartsAt: l.event.starts_at,
        ticketsSold: sold,
        grossCents: gross,
        commissionPct: l.commission_pct,
        commissionCents: commission,
        payoutStatus: payout?.status ?? "none",
      });
    }
    return out.sort((a, b) => b.eventStartsAt.localeCompare(a.eventStartsAt));
  },

  async generateInviteToken({ eventSlug, orgId }) {
    // Token = base64url(eventSlug). El "comisión" se guarda como per-link al aprobar.
    const db = supabaseAdmin();
    const { data: ev } = await db
      .from("events")
      .select("id, organization_id")
      .eq("slug", eventSlug)
      .maybeSingle<{ id: string; organization_id: string }>();
    if (!ev) return err("event_not_found");
    if (ev.organization_id !== orgId) return err("forbidden");
    const token = Buffer.from(eventSlug).toString("base64url");
    return ok({
      token,
      url: `/apply/${token}`,
    });
  },

  async resolveInviteToken(token) {
    const db = supabaseAdmin();
    let slug: string;
    try {
      slug = Buffer.from(token, "base64url").toString("utf8");
    } catch {
      return null;
    }
    const { data: ev } = await db
      .from("events")
      .select(
        "id, slug, title, organization:organizations!inner(name)",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (!ev) return null;
    type E = {
      id: string;
      slug: string;
      title: string;
      organization: { name: string };
    };
    const e = ev as unknown as E;
    return {
      eventId: e.id,
      eventSlug: e.slug,
      eventTitle: e.title,
      commissionPct: 15,
      orgName: e.organization.name,
    };
  },

  async applyByToken({ token, applicantId, message }) {
    const db = supabaseAdmin();
    const resolved = await this.resolveInviteToken(token);
    if (!resolved) return err("invalid_token");

    // Si ya existe link activo, devolver "approved" implícito vía status.
    const { data: link } = await db
      .from("promoter_links")
      .select("id")
      .eq("event_id", resolved.eventId)
      .eq("promoter_id", applicantId)
      .maybeSingle<{ id: string }>();
    if (link) return ok({ applicationId: link.id, eventSlug: resolved.eventSlug });

    const { data: existing } = await db
      .from("promoter_applications")
      .select("id")
      .eq("event_id", resolved.eventId)
      .eq("applicant_id", applicantId)
      .maybeSingle<{ id: string }>();
    if (existing) return ok({ applicationId: existing.id, eventSlug: resolved.eventSlug });

    const { data: created, error } = await db
      .from("promoter_applications")
      .insert({
        event_id: resolved.eventId,
        applicant_id: applicantId,
        message,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !created) return err(error?.message ?? "apply_failed");
    return ok({ applicationId: created.id, eventSlug: resolved.eventSlug });
  },

  async getApplicationStatus(applicantId, eventSlug) {
    const db = supabaseAdmin();
    const { data: ev } = await db
      .from("events")
      .select("id")
      .eq("slug", eventSlug)
      .maybeSingle<{ id: string }>();
    if (!ev) return null;

    const { data: link } = await db
      .from("promoter_links")
      .select(
        "*, event:events!inner(id, slug, title, starts_at, venue, organization_id)",
      )
      .eq("event_id", ev.id)
      .eq("promoter_id", applicantId)
      .maybeSingle();
    if (link) return { status: "approved", link: toLink(link as unknown as LinkRow) };

    const { data: app } = await db
      .from("promoter_applications")
      .select("status")
      .eq("event_id", ev.id)
      .eq("applicant_id", applicantId)
      .maybeSingle<{ status: PromoterApplication["status"] }>();
    if (!app) return null;
    return { status: app.status, link: null };
  },

  async listPendingApplications(eventSlug, orgId) {
    const db = supabaseAdmin();
    const { data: ev } = await db
      .from("events")
      .select("id, slug, title, organization_id")
      .eq("slug", eventSlug)
      .maybeSingle<{ id: string; slug: string; title: string; organization_id: string }>();
    if (!ev || ev.organization_id !== orgId) return [];

    const { data: rows } = await db
      .from("promoter_applications")
      .select(
        "id, status, message, created_at, applicant:profiles!promoter_applications_applicant_id_fkey(id, full_name, phone, email)",
      )
      .eq("event_id", ev.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    type Row = {
      id: string;
      status: PromoterApplication["status"];
      message: string | null;
      created_at: string;
      applicant: { id: string; full_name: string | null; phone: string | null; email: string | null };
    };
    return ((rows as unknown as Row[] | null) ?? []).map((r) => ({
      id: r.id,
      eventId: ev.id,
      eventSlug: ev.slug,
      eventTitle: ev.title,
      applicantId: r.applicant.id,
      applicantName: r.applicant.full_name ?? r.applicant.phone ?? r.applicant.email ?? "—",
      applicantHandle: r.applicant.email ?? r.applicant.phone,
      status: r.status,
      message: r.message,
      createdAt: r.created_at,
    }));
  },

  async decideApplication({ applicationId, decidedBy, orgId, decision, commissionPct }) {
    const db = supabaseAdmin();
    const { data: app } = await db
      .from("promoter_applications")
      .select("id, event_id, applicant_id, event:events!inner(id, slug, title, starts_at, venue, organization_id)")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app) return err("application_not_found");
    type AppRow = {
      id: string;
      event_id: string;
      applicant_id: string;
      event: {
        id: string;
        slug: string;
        title: string;
        starts_at: string;
        venue: string | null;
        organization_id: string;
      };
    };
    const a = app as unknown as AppRow;
    if (a.event.organization_id !== orgId) return err("forbidden");

    await db
      .from("promoter_applications")
      .update({
        status: decision,
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (decision === "rejected") return ok({ link: null });

    const { data: applicant } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", a.applicant_id)
      .maybeSingle<{ full_name: string | null }>();
    const base = slugCode(applicant?.full_name ?? "promotor");
    const code = `${base}-${crypto.randomBytes(2).toString("hex")}`;

    const { data: created, error } = await db
      .from("promoter_links")
      .insert({
        event_id: a.event_id,
        promoter_id: a.applicant_id,
        code,
        commission_pct: commissionPct,
        active: true,
      })
      .select(
        "*, event:events!inner(id, slug, title, starts_at, venue, organization_id)",
      )
      .single();
    if (error || !created) return err(error?.message ?? "link_create_failed");
    return ok({ link: toLink(created as unknown as LinkRow) });
  },
};

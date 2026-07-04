import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok } from "@/server/_shared/result";
import crypto from "node:crypto";
import type { PromoterRepository } from "@/server/promoters/ports/PromoterRepository";
import type {
  PromoterApplication,
  PromoterEventEarning,
  PromoterLink,
} from "@/server/promoters/domain/Promoter";
import type { CommissionType } from "@/server/promoters/domain/OrgPromoter";
import { resolveCommissionScheme } from "@/server/promoters/application/CommissionResolver";

type LinkRow = {
  id: string;
  event_id: string;
  promoter_id: string | null;
  org_promoter_id: string | null;
  code: string;
  commission_pct: number;
  active: boolean;
  created_at: string;
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

// Campos extra del esquema de comisión (evento + marca) que se suman al LinkRow
// cuando queremos resolver el % efectivo heredado.
type SchemeRow = {
  commission_type: CommissionType | null;
  commission_config_override: unknown;
  event: {
    promoter_commission_pct: number | null;
    promoter_commission_type: CommissionType | null;
    promoter_commission_config: unknown;
  };
  org_promoter: {
    default_commission_pct: number | null;
    commission_type: CommissionType | null;
    commission_config: unknown;
  } | null;
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
        "*, event:events!inner(id, slug, title, starts_at, venue, organization_id, status, " +
          "promoter_commission_pct, promoter_commission_type, promoter_commission_config), " +
          "org_promoter:org_promoters(default_commission_pct, commission_type, commission_config)",
      )
      .eq("promoter_id", promoterId)
      .order("created_at", { ascending: false });
    const rows = (data as unknown as (LinkRow & SchemeRow)[] | null) ?? [];
    // commissionPct del dominio = % EFECTIVO (heredado), no el crudo del link:
    // con herencia el link tiene commission_pct null y sin esto se vería "null%".
    // Mismo resolver de 3 niveles que earnings/home — una sola fuente de verdad.
    return rows.map((r) => {
      const scheme = resolveCommissionScheme({
        linkType: r.commission_type ?? null,
        linkPct: r.commission_pct,
        linkConfigOverride: r.commission_config_override,
        eventType: r.event.promoter_commission_type,
        eventConfig: r.event.promoter_commission_config,
        eventPct: r.event.promoter_commission_pct,
        orgType: r.org_promoter?.commission_type ?? null,
        orgConfig: r.org_promoter?.commission_config ?? null,
        orgPct: r.org_promoter?.default_commission_pct ?? null,
      });
      return { ...toLink(r), commissionPct: scheme.pct };
    });
  },

  async getHomeData(promoterId, slug) {
    const db = supabaseAdmin();
    const { data: link } = await db
      .from("promoter_links")
      .select(
        "*, event:events!inner(id, slug, title, starts_at, venue, organization_id, status, " +
          "promoter_commission_pct, promoter_commission_type, promoter_commission_config), " +
          "org_promoter:org_promoters(default_commission_pct, commission_type, commission_config)",
      )
      .eq("promoter_id", promoterId)
      .eq("event.slug", slug)
      .maybeSingle();
    if (!link) return null;
    const l = toLink(link as unknown as LinkRow);

    // Cómo le pagan: mismo resolver de 3 niveles (link → evento → marca) que
    // usa el organizador y el route /r/[code]/state.
    const lr = link as unknown as {
      commission_type: CommissionType | null;
      commission_pct: number | null;
      commission_config_override: unknown;
      event: {
        promoter_commission_type: CommissionType | null;
        promoter_commission_config: unknown;
        promoter_commission_pct: number | null;
      };
      org_promoter: {
        commission_type: CommissionType | null;
        commission_config: unknown;
        default_commission_pct: number | null;
      } | null;
    };
    const scheme = resolveCommissionScheme({
      linkType: lr.commission_type,
      linkPct: lr.commission_pct,
      linkConfigOverride: lr.commission_config_override,
      eventType: lr.event.promoter_commission_type,
      eventConfig: lr.event.promoter_commission_config,
      eventPct: lr.event.promoter_commission_pct,
      orgType: lr.org_promoter?.commission_type ?? null,
      orgConfig: lr.org_promoter?.commission_config ?? null,
      orgPct: lr.org_promoter?.default_commission_pct ?? null,
    });

    // total_cents > 0 = venta real. Las órdenes gratis (S/0) también quedan
    // 'paid', así que se excluyen para no inflar "Vendidas" ni aparecer como
    // "compró" en la actividad.
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

    return {
      link: l,
      soldCount: count ?? 0,
      recent,
      commissionType: scheme.type,
      commissionPct: scheme.pct,
      commissionConfig: scheme.config,
    };
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
        "id, slug, title, promoter_commission_pct, promoter_commission_type, " +
          "promoter_commission_config, organization:organizations!inner(name)",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (!ev) return null;
    type E = {
      id: string;
      slug: string;
      title: string;
      promoter_commission_pct: number | null;
      promoter_commission_type: CommissionType | null;
      promoter_commission_config: unknown;
      organization: { name: string };
    };
    const e = ev as unknown as E;
    // Esquema que verá el candidato ANTES de unirse: aún no hay link ni override
    // de marca, así que solo aplica el nivel EVENTO — mismo resolver que usa el
    // resto (una sola fuente de verdad de la herencia). Si el organizador no
    // definió nada, pct=0/config=null → la vista muestra "por definir".
    const scheme = resolveCommissionScheme({
      linkType: null,
      linkPct: null,
      linkConfigOverride: null,
      eventType: e.promoter_commission_type,
      eventConfig: e.promoter_commission_config,
      eventPct: e.promoter_commission_pct,
      orgType: null,
      orgConfig: null,
      orgPct: null,
    });
    return {
      eventId: e.id,
      eventSlug: e.slug,
      eventTitle: e.title,
      orgName: e.organization.name,
      commissionType: scheme.type,
      commissionPct: scheme.pct,
      commissionConfig: scheme.config,
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

    // Un promotor aprobado ES un promotor de la marca: lo inscribimos en el pool
    // (org_promoters) y enganchamos su link, para que herede también el nivel
    // MARCA (link → evento → marca), igual que los agregados desde el brand. Sin
    // esto, los que entran por el link de grupo se quedaban sin nivel marca.
    // Buscar-o-crear por profile: un promotor que vuelve reusa su fila, no se
    // duplica en el pool.
    let orgPromoterId: string | null = null;
    const { data: existingOrgPromoter } = await db
      .from("org_promoters")
      .select("id")
      .eq("organization_id", orgId)
      .eq("profile_id", a.applicant_id)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();
    if (existingOrgPromoter) {
      orgPromoterId = existingOrgPromoter.id;
    } else {
      const { data: createdOrgPromoter } = await db
        .from("org_promoters")
        .insert({
          organization_id: orgId,
          name: applicant?.full_name ?? "Promotor",
          profile_id: a.applicant_id,
          created_by: decidedBy,
        })
        .select("id")
        .maybeSingle<{ id: string }>();
      orgPromoterId = createdOrgPromoter?.id ?? null;
    }

    const { data: created, error } = await db
      .from("promoter_links")
      .insert({
        event_id: a.event_id,
        promoter_id: a.applicant_id,
        // Engancha al pool de la marca → habilita la herencia del nivel marca.
        org_promoter_id: orgPromoterId,
        code,
        // null → el link NO fija % propio y hereda el esquema del evento
        // (resolveCommissionScheme: link → evento → marca). Solo se guarda un
        // número cuando el organizador overridea a este promotor puntual.
        commission_pct: commissionPct ?? null,
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

import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok } from "@/server/_shared/result";
import crypto from "node:crypto";
import type { PromoterRepository } from "@/server/promoters/ports/PromoterRepository";
import type {
  PromoterApplication,
  PromoterEventEarning,
  PromoterLink,
} from "@/server/promoters/domain/Promoter";
import { computePromoterPayout, resolveCommissionScheme } from "@/server/promoters/application/CommissionResolver";

// Bytes de entropía del token opaco de invitación de promotor (LOW-4).
const PROMOTER_APPLY_TOKEN_BYTES = 16;

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
  commission_config_override: unknown;
  event: {
    promoter_commission_pct: number | null;
    promoter_commission_config: unknown;
    organization: {
      promoter_commission_pct: number | null;
      promoter_commission_config: unknown;
    } | null;
  };
  org_promoter: {
    default_commission_pct: number | null;
    commission_config: unknown;
  } | null;
};

// Ventana simétrica alrededor de startsAt (antes y después) en la que el
// evento se considera "live" para el status del link de promotor.
const LIVE_WINDOW_MS = 6 * 60 * 60 * 1000;

const computeEventStatus = (
  startsAt: string,
  status: string,
  now: Date,
): "live" | "upcoming" | "closed" => {
  if (status === "closed" || status === "cancelled") return "closed";
  const diffMs = new Date(startsAt).getTime() - now.getTime();
  if (Math.abs(diffMs) <= LIVE_WINDOW_MS) return "live";
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
          "promoter_commission_pct, promoter_commission_config, organization:organizations(promoter_commission_pct, promoter_commission_config)), " +
          "org_promoter:org_promoters(default_commission_pct, commission_config)",
      )
      .eq("promoter_id", promoterId)
      .order("created_at", { ascending: false });
    const rows = (data as unknown as (LinkRow & SchemeRow)[] | null) ?? [];
    // commissionPct del dominio = % EFECTIVO (heredado), no el crudo del link:
    // con herencia el link tiene commission_pct null y sin esto se vería "null%".
    // Mismo resolver de 3 niveles que earnings/home — una sola fuente de verdad.
    return rows.map((r) => {
      const scheme = resolveCommissionScheme({
        linkPct: r.commission_pct,
        linkConfigOverride: r.commission_config_override,
        promoterPct: r.org_promoter?.default_commission_pct ?? null,
        promoterConfig: r.org_promoter?.commission_config ?? null,
        eventPct: r.event.promoter_commission_pct,
        eventConfig: r.event.promoter_commission_config,
        brandPct: r.event.organization?.promoter_commission_pct ?? null,
        brandConfig: r.event.organization?.promoter_commission_config ?? null,
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
          "promoter_commission_pct, promoter_commission_config, organization:organizations(promoter_commission_pct, promoter_commission_config)), " +
          "org_promoter:org_promoters(default_commission_pct, commission_config)",
      )
      .eq("promoter_id", promoterId)
      .eq("event.slug", slug)
      .maybeSingle();
    if (!link) return null;
    const l = toLink(link as unknown as LinkRow);

    // Cómo le pagan: mismo resolver de 3 niveles (link → evento → marca) que
    // usa el organizador y el route /r/[code]/state.
    const lr = link as unknown as {
      commission_pct: number | null;
      commission_config_override: unknown;
      event: {
        promoter_commission_config: unknown;
        promoter_commission_pct: number | null;
        organization: {
          promoter_commission_pct: number | null;
          promoter_commission_config: unknown;
        } | null;
      };
      org_promoter: {
        commission_config: unknown;
        default_commission_pct: number | null;
      } | null;
    };
    const scheme = resolveCommissionScheme({
      linkPct: lr.commission_pct,
      linkConfigOverride: lr.commission_config_override,
      promoterPct: lr.org_promoter?.default_commission_pct ?? null,
      promoterConfig: lr.org_promoter?.commission_config ?? null,
      eventPct: lr.event.promoter_commission_pct,
      eventConfig: lr.event.promoter_commission_config,
      brandPct: lr.event.organization?.promoter_commission_pct ?? null,
      brandConfig: lr.event.organization?.promoter_commission_config ?? null,
    });

    // "Vendidas" = ENTRADAS vendidas (canónico: promoter_sold_units), no compras.
    // Una compra de 3 entradas cuenta 3 — así el progreso de un hito "10 entradas"
    // coincide con su desbloqueo. Las gratis (S/0) no cuentan.
    const { data: soldData } = await db.rpc("promoter_sold_units", { p_link_id: l.id });
    const count = (soldData as number | null) ?? 0;

    // "Asistidas" = validadas en puerta (gratis+pago). Unidad de las metas por
    // asistencia — el progreso solo sube cuando su gente entra, no al vender.
    const { data: attendedData } = await db.rpc("promoter_attended_units", { p_link_id: l.id });
    const attendedCount = (attendedData as number | null) ?? 0;

    const { data: orders } = await db
      .from("orders")
      .select("created_at, total_cents, buyer:profiles!inner(full_name)")
      .eq("promoter_link_id", l.id)
      .eq("status", "paid")
      .gt("total_cents", 0)
      .order("created_at", { ascending: false })
      .limit(10);

    type OrderRow = { created_at: string; total_cents: number; buyer: { full_name: string | null } };
    const orderRows = (orders as unknown as OrderRow[] | null) ?? [];
    const recent = orderRows.slice(0, 10).map((o) => ({
      firstName: (o.buyer?.full_name ?? "Alguien").split(" ")[0] ?? "Alguien",
      createdAt: o.created_at,
    }));

    // "Generado" del home: mismo cálculo que /r/[code]/state y getEarnings
    // (% del vendido + hitos cash). El `limit(10)` de arriba es solo para
    // "recent"; el gross para el payout necesita TODAS las órdenes pagadas.
    const { data: grossOrders } = await db
      .from("orders")
      .select("total_cents")
      .eq("promoter_link_id", l.id)
      .eq("status", "paid")
      .gt("total_cents", 0);
    const grossCents = ((grossOrders as Array<{ total_cents: number }> | null) ?? []).reduce(
      (a, o) => a + o.total_cents,
      0,
    );
    const payoutCents = computePromoterPayout({
      pct: scheme.pct,
      config: scheme.config,
      soldUnits: count ?? 0,
      attendedUnits: attendedCount,
      grossCents,
    }).payoutCents;

    return {
      link: l,
      soldCount: count ?? 0,
      attendedCount,
      recent,
      commissionPct: scheme.pct,
      commissionConfig: scheme.config,
      schemeConfigured: scheme.configured,
      payoutCents,
    };
  },

  async getEarnings(promoterId) {
    const db = supabaseAdmin();
    const { data: links } = await db
      .from("promoter_links")
      .select(
        "id, commission_pct, commission_config_override, event:events!inner(id, slug, title, starts_at, promoter_commission_pct, promoter_commission_config, organization:organizations(promoter_commission_pct, promoter_commission_config)), org_promoter:org_promoters(default_commission_pct, commission_config)",
      )
      .eq("promoter_id", promoterId);
    type LL = {
      id: string;
      commission_pct: number | null;
      commission_config_override: unknown;
      event: {
        id: string;
        slug: string;
        title: string;
        starts_at: string;
        promoter_commission_pct: number | null;
        promoter_commission_config: unknown;
        organization: {
          promoter_commission_pct: number | null;
          promoter_commission_config: unknown;
        } | null;
      };
      org_promoter: {
        default_commission_pct: number | null;
        commission_config: unknown;
      } | null;
    };
    const list = ((links as unknown as LL[] | null) ?? []);
    const out: PromoterEventEarning[] = [];
    for (const l of list) {
      const { data: orders } = await db
        .from("orders")
        .select("total_cents")
        .eq("promoter_link_id", l.id)
        .eq("status", "paid")
        .gt("total_cents", 0);
      const orderRows = (orders as Array<{ total_cents: number }> | null) ?? [];
      const gross = orderRows.reduce((a, o) => a + o.total_cents, 0);

      // Conteos canónicos: vendidas (pago) y asistidas (validadas, gratis+pago).
      const { data: soldData } = await db.rpc("promoter_sold_units", { p_link_id: l.id });
      const sold = (soldData as number | null) ?? 0;
      const { data: attendedData } = await db.rpc("promoter_attended_units", { p_link_id: l.id });
      const attended = (attendedData as number | null) ?? 0;

      // Esquema efectivo por herencia (link → evento → marca), evaluado al vuelo:
      // % del vendido + hitos conseguidos (por venta o asistencia según basis).
      const scheme = resolveCommissionScheme({
        linkPct: l.commission_pct,
        linkConfigOverride: l.commission_config_override,
        promoterPct: l.org_promoter?.default_commission_pct ?? null,
        promoterConfig: l.org_promoter?.commission_config ?? null,
        eventPct: l.event.promoter_commission_pct,
        eventConfig: l.event.promoter_commission_config,
        brandPct: l.event.organization?.promoter_commission_pct ?? null,
        brandConfig: l.event.organization?.promoter_commission_config ?? null,
      });
      const commission = computePromoterPayout({
        pct: scheme.pct,
        config: scheme.config,
        soldUnits: sold,
        attendedUnits: attended,
        grossCents: gross,
      }).payoutCents;

      // Conteo de hitos para la fila del historial ("X/Y hitos"), según el basis.
      const milestones = scheme.config ? scheme.config.milestones : [];
      const basisCount = scheme.config?.basis === "attended" ? attended : sold;
      const unlockedMilestones = milestones.filter((m) => basisCount >= m.threshold).length;

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
        commissionPct: scheme.pct,
        commissionCents: commission,
        payoutStatus: payout?.status ?? "none",
        totalMilestones: milestones.length,
        unlockedMilestones,
      });
    }
    return out.sort((a, b) => b.eventStartsAt.localeCompare(a.eventStartsAt));
  },

  async generateInviteToken({ eventSlug, orgId }) {
    // Token opaco random persistido en events.promoter_apply_token (LOW-4):
    // ya NO es derivable a partir del slug público. Idempotente — si el
    // evento ya tiene un token vigente, lo reutilizamos.
    const db = supabaseAdmin();
    const { data: ev } = await db
      .from("events")
      .select("id, organization_id, promoter_apply_token")
      .eq("slug", eventSlug)
      .maybeSingle<{ id: string; organization_id: string; promoter_apply_token: string | null }>();
    if (!ev) return err("event_not_found");
    if (ev.organization_id !== orgId) return err("forbidden");

    let token = ev.promoter_apply_token;
    if (!token) {
      token = crypto.randomBytes(PROMOTER_APPLY_TOKEN_BYTES).toString("base64url");
      const { error } = await db
        .from("events")
        .update({ promoter_apply_token: token })
        .eq("id", ev.id);
      if (error) return err(error.message);
    }
    return ok({
      token,
      url: `/apply/${token}`,
    });
  },

  async resolveInviteToken(token) {
    const db = supabaseAdmin();
    const { data: ev } = await db
      .from("events")
      .select(
        "id, slug, title, promoter_commission_pct, promoter_commission_config, " +
          "organization:organizations!inner(name, promoter_commission_pct, promoter_commission_config)",
      )
      .eq("promoter_apply_token", token)
      .maybeSingle();
    if (!ev) return null;
    type E = {
      id: string;
      slug: string;
      title: string;
      promoter_commission_pct: number | null;
      promoter_commission_config: unknown;
      organization: {
        name: string;
        promoter_commission_pct: number | null;
        promoter_commission_config: unknown;
      };
    };
    const e = ev as unknown as E;
    // Esquema que verá el candidato ANTES de unirse: aún no hay link ni tarifa
    // propia, así que aplican EVENTO → MARCA (mismo resolver que el resto). Si el
    // organizador no definió nada, pct=0/config=null → la vista muestra "por definir".
    const scheme = resolveCommissionScheme({
      linkPct: null,
      linkConfigOverride: null,
      promoterPct: null,
      promoterConfig: null,
      eventPct: e.promoter_commission_pct,
      eventConfig: e.promoter_commission_config,
      brandPct: e.organization.promoter_commission_pct,
      brandConfig: e.organization.promoter_commission_config,
    });
    return {
      eventId: e.id,
      eventSlug: e.slug,
      eventTitle: e.title,
      orgName: e.organization.name,
      commissionPct: scheme.pct,
      commissionConfig: scheme.config,
    };
  },

  async applyByToken({ token, applicantId, message, fullName }) {
    const db = supabaseAdmin();
    const resolved = await this.resolveInviteToken(token);
    if (!resolved) return err("invalid_token");

    // Persistimos el nombre tecleado en el profile: es la fuente que lee
    // listPendingApplications (applicantName ← profiles.full_name). Sin esto
    // el campo requerido del form se pierde y el organizador ve "—".
    const trimmedName = fullName?.trim();
    if (trimmedName) {
      await db.from("profiles").update({ full_name: trimmedName }).eq("id", applicantId);
    }

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

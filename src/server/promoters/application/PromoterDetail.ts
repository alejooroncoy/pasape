import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { OrgPromoter } from "../domain/OrgPromoter";

export type PromoterDetailEvent = {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventStartsAt: string;
  ticketsSold: number;
  ticketsValidated: number;
  grossCents: number;
  commissionPct: number;
  commissionCents: number;
  promoterLinkId: string;
  code: string;
  url: string;
};

export type PromoterDetail = {
  promoter: OrgPromoter;
  totals: {
    eventsCount: number;
    ticketsSold: number;
    ticketsValidated: number;
    revenueCents: number;
    commissionCents: number;
  };
  byEvent: PromoterDetailEvent[];
};

/**
 * Aggregate cross-event stats for a single org_promoter.
 * - One row per promoter_link (i.e. per event the promoter was assigned to).
 * - Tickets/revenue/commission computed from paid orders + their tickets.
 */
export const getOrgPromoterDetail = async (
  promoter: OrgPromoter,
  origin: string,
): Promise<PromoterDetail> => {
  const db = supabaseAdmin();

  const { data: links } = await db
    .from("promoter_links")
    .select(
      "id, code, commission_pct, event_id, event:events!inner(id, slug, title, starts_at)",
    )
    .eq("org_promoter_id", promoter.id);

  type LinkRow = {
    id: string;
    code: string;
    commission_pct: number;
    event_id: string;
    event: { id: string; slug: string; title: string; starts_at: string } | null;
  };
  const linkRows = (links as unknown as LinkRow[] | null) ?? [];

  if (linkRows.length === 0) {
    return {
      promoter,
      totals: {
        eventsCount: 0,
        ticketsSold: 0,
        ticketsValidated: 0,
        revenueCents: 0,
        commissionCents: 0,
      },
      byEvent: [],
    };
  }

  const linkIds = linkRows.map((l) => l.id);

  // Paid orders for these links
  const { data: orders } = await db
    .from("orders")
    .select("id, total_cents, promoter_link_id")
    .in("promoter_link_id", linkIds)
    .eq("status", "paid");
  type OrderRow = { id: string; total_cents: number; promoter_link_id: string };
  const orderRows = (orders as OrderRow[] | null) ?? [];

  // Tickets per order (sold + validated counters)
  const orderIds = orderRows.map((o) => o.id);
  let ticketsByOrder = new Map<string, { sold: number; validated: number }>();
  if (orderIds.length > 0) {
    const { data: tickets } = await db
      .from("tickets")
      .select("order_id, status")
      .in("order_id", orderIds);
    const rows =
      (tickets as Array<{ order_id: string; status: "active" | "used" | "void" | "refunded" }> | null) ?? [];
    ticketsByOrder = rows.reduce((acc, t) => {
      // Solo activas/usadas cuentan como vendidas; void/refunded no inflan el
      // ticketsSold que alimenta el cálculo de comisión.
      if (t.status !== "active" && t.status !== "used") return acc;
      const entry = acc.get(t.order_id) ?? { sold: 0, validated: 0 };
      entry.sold += 1;
      if (t.status === "used") entry.validated += 1;
      acc.set(t.order_id, entry);
      return acc;
    }, new Map<string, { sold: number; validated: number }>());
  }

  // Aggregate per promoter_link
  const perLink = new Map<
    string,
    { ticketsSold: number; ticketsValidated: number; grossCents: number }
  >();
  for (const o of orderRows) {
    const entry =
      perLink.get(o.promoter_link_id) ?? { ticketsSold: 0, ticketsValidated: 0, grossCents: 0 };
    const t = ticketsByOrder.get(o.id) ?? { sold: 0, validated: 0 };
    entry.ticketsSold += t.sold;
    entry.ticketsValidated += t.validated;
    entry.grossCents += o.total_cents ?? 0;
    perLink.set(o.promoter_link_id, entry);
  }

  const cleanOrigin = origin.replace(/\/$/, "");

  // Fetch unlocked tiers for all links in one query.
  const { data: allTiers } = await db
    .from("commission_tiers")
    .select("promoter_link_id, reward_amount_cents")
    .in("promoter_link_id", linkIds)
    .not("unlocked_at", "is", null);
  type TierRow = { promoter_link_id: string; reward_amount_cents: number | null };
  const tiersByLink = ((allTiers as TierRow[] | null) ?? []).reduce(
    (acc, t) => {
      acc.set(t.promoter_link_id, (acc.get(t.promoter_link_id) ?? 0) + (t.reward_amount_cents ?? 0));
      return acc;
    },
    new Map<string, number>(),
  );

  const byEvent: PromoterDetailEvent[] = linkRows
    .filter((l) => l.event !== null)
    .map((l) => {
      const stats = perLink.get(l.id) ?? { ticketsSold: 0, ticketsValidated: 0, grossCents: 0 };
      const unlockedTiersCents = tiersByLink.get(l.id);
      const commissionCents =
        unlockedTiersCents !== undefined
          ? unlockedTiersCents
          : Math.round((stats.grossCents * l.commission_pct) / 100);
      return {
        eventId: l.event!.id,
        eventSlug: l.event!.slug,
        eventTitle: l.event!.title,
        eventStartsAt: l.event!.starts_at,
        ticketsSold: stats.ticketsSold,
        ticketsValidated: stats.ticketsValidated,
        grossCents: stats.grossCents,
        commissionPct: l.commission_pct,
        commissionCents,
        promoterLinkId: l.id,
        code: l.code,
        url: `${cleanOrigin}/r/${l.code}`,
      };
    })
    .sort((a, b) => new Date(b.eventStartsAt).getTime() - new Date(a.eventStartsAt).getTime());

  const totals = byEvent.reduce(
    (acc, e) => {
      acc.eventsCount += 1;
      acc.ticketsSold += e.ticketsSold;
      acc.ticketsValidated += e.ticketsValidated;
      acc.revenueCents += e.grossCents;
      acc.commissionCents += e.commissionCents;
      return acc;
    },
    { eventsCount: 0, ticketsSold: 0, ticketsValidated: 0, revenueCents: 0, commissionCents: 0 },
  );

  return { promoter, totals, byEvent };
};

export type PromoterLinkSale = {
  orderId: string;
  buyerName: string | null;
  buyerEmail: string | null;
  ticketTypeName: string;
  ticketCount: number;
  totalCents: number;
  paidAt: string;
};

/**
 * List paid orders attributed to one promoter_link, with per-order buyer + ticket type breakdown.
 * If an order has multiple ticket types, ticketTypeName uses the first/main one and ticketCount is total.
 */
export const listSalesForPromoterLink = async (
  promoterLinkId: string,
  eventId: string,
): Promise<PromoterLinkSale[]> => {
  const db = supabaseAdmin();

  const { data: orders } = await db
    .from("orders")
    .select(
      "id, total_cents, paid_at, buyer:profiles(id, full_name, email)",
    )
    .eq("promoter_link_id", promoterLinkId)
    .eq("event_id", eventId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false });

  type OrderRow = {
    id: string;
    total_cents: number;
    paid_at: string | null;
    buyer: { id: string; full_name: string | null; email: string | null } | null;
  };
  const orderRows = (orders as unknown as OrderRow[] | null) ?? [];
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);
  const { data: tickets } = await db
    .from("tickets")
    .select("order_id, ticket_type:ticket_types!inner(id, name)")
    .in("order_id", orderIds);

  type TicketRow = {
    order_id: string;
    ticket_type: { id: string; name: string } | null;
  };
  const ticketRows = (tickets as unknown as TicketRow[] | null) ?? [];

  const ticketsByOrder = new Map<string, { count: number; firstName: string }>();
  for (const t of ticketRows) {
    const entry = ticketsByOrder.get(t.order_id) ?? {
      count: 0,
      firstName: t.ticket_type?.name ?? "",
    };
    entry.count += 1;
    if (!entry.firstName && t.ticket_type?.name) entry.firstName = t.ticket_type.name;
    ticketsByOrder.set(t.order_id, entry);
  }

  return orderRows.map((o) => {
    const tinfo = ticketsByOrder.get(o.id) ?? { count: 0, firstName: "" };
    return {
      orderId: o.id,
      buyerName: o.buyer?.full_name ?? null,
      buyerEmail: o.buyer?.email ?? null,
      ticketTypeName: tinfo.firstName,
      ticketCount: tinfo.count,
      totalCents: o.total_cents ?? 0,
      paidAt: o.paid_at ?? "",
    };
  });
};

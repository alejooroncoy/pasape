import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import {
  computePromoterPayout,
  resolveCommissionScheme,
} from "@/server/promoters/application/CommissionResolver";
import type { CommissionType } from "@/server/promoters/domain/OrgPromoter";

const resolveOrigin = async (req: NextRequest) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? req.nextUrl.host;
  const proto = h.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
};

/**
 * Public state for a promoter's personal landing (`/r/[code]`).
 *
 * No auth: anyone holding the link can see the promoter's progress. The link
 * itself acts as the secret (it's already shared publicly with buyers).
 */
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) => {
  const { code } = await params;
  const db = supabaseAdmin();

  const { data: linkRow } = await db
    .from("promoter_links")
    .select(
      "id, code, commission_pct, commission_type, commission_config_override, event:events!inner(id, slug, title, starts_at, venue, organization_id, promoter_commission_pct, promoter_commission_type, promoter_commission_config), profile:profiles(id, full_name), org_promoter:org_promoters(id, name, default_commission_pct, commission_type, commission_config)",
    )
    .eq("code", code)
    .maybeSingle();

  type Row = {
    id: string;
    code: string;
    commission_pct: number | null;
    commission_type: CommissionType | null;
    commission_config_override: unknown;
    event: {
      id: string;
      slug: string;
      title: string;
      starts_at: string;
      venue: string | null;
      organization_id: string;
      promoter_commission_pct: number | null;
      promoter_commission_type: CommissionType | null;
      promoter_commission_config: unknown;
    };
    profile: { id: string; full_name: string | null } | null;
    org_promoter: {
      id: string;
      name: string;
      default_commission_pct: number;
      commission_type: CommissionType;
      commission_config: unknown;
    } | null;
  };

  const link = linkRow as unknown as Row | null;
  if (!link) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Esquema efectivo por herencia: promotor en el evento → esquema del evento →
  // marca. "percentage" como fallback para links legacy sin org_promoter.
  const {
    type: commissionType,
    config: commissionConfig,
    pct: commissionPct,
  } = resolveCommissionScheme({
    linkType: link.commission_type,
    linkPct: link.commission_pct,
    linkConfigOverride: link.commission_config_override,
    eventType: link.event.promoter_commission_type,
    eventConfig: link.event.promoter_commission_config,
    eventPct: link.event.promoter_commission_pct,
    orgType: link.org_promoter?.commission_type ?? null,
    orgConfig: link.org_promoter?.commission_config ?? null,
    orgPct: link.org_promoter?.default_commission_pct ?? null,
  });

  // Paid orders attributed to this link
  const { data: orders } = await db
    .from("orders")
    .select("id, total_cents")
    .eq("promoter_link_id", link.id)
    .eq("status", "paid");
  const orderRows = (orders as Array<{ id: string; total_cents: number }> | null) ?? [];
  const grossCents = orderRows.reduce((acc, o) => acc + (o.total_cents ?? 0), 0);

  let ticketsSold = 0;
  let ticketsValidated = 0;
  if (orderRows.length > 0) {
    const { data: tickets } = await db
      .from("tickets")
      .select("status")
      .in(
        "order_id",
        orderRows.map((o) => o.id),
      );
    const tRows = (tickets as Array<{ status: string }> | null) ?? [];
    ticketsSold = tRows.length;
    ticketsValidated = tRows.filter((t) => t.status === "used").length;
  }

  const payout = computePromoterPayout({
    type: commissionType,
    config: commissionConfig,
    pct: commissionPct,
    ticketsSold,
    grossCents,
  });

  // Resolve org slug for the public sale URL: /{orgSlug}?promo={code}
  const { data: orgRow } = await db
    .from("organizations")
    .select("slug")
    .eq("id", link.event.organization_id)
    .maybeSingle<{ slug: string }>();
  const origin = await resolveOrigin(req);
  const publicSaleUrl = orgRow
    ? `${origin}/${orgRow.slug}?promo=${encodeURIComponent(link.code)}`
    : `${origin}/?promo=${encodeURIComponent(link.code)}`;

  const promoterName =
    link.profile?.full_name?.split(" ")[0] ??
    link.org_promoter?.name?.split(" ")[0] ??
    "Promotor";

  return NextResponse.json({
    ok: true,
    promoterName,
    eventTitle: link.event.title,
    eventStartsAt: link.event.starts_at,
    eventVenue: link.event.venue,
    eventSlug: link.event.slug,
    ticketsSold,
    ticketsValidated,
    grossCents,
    commissionType,
    commissionConfig,
    commissionPct,
    payoutCents: payout.payoutCents,
    unlockedRewards: payout.rewards,
    publicSaleUrl,
  });
};

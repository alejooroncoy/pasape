import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { computePromoterPayout } from "@/server/promoters/application/CommissionResolver";
import type {
  CommissionConfig,
  CommissionType,
} from "@/server/promoters/domain/OrgPromoter";

// Same json-coercion as in SupabaseEventRepository — kept local to avoid an
// extra module just for this. If we add another consumer we'll extract it.
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
      const r = t as Record<string, unknown>;
      const salesCount = Number(r.salesCount);
      const payoutCents = Number(r.payoutCents);
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
      "id, code, commission_pct, commission_config_override, event:events!inner(id, slug, title, starts_at, venue, organization_id), profile:profiles(id, full_name), org_promoter:org_promoters(id, name, default_commission_pct, commission_type, commission_config)",
    )
    .eq("code", code)
    .maybeSingle();

  type Row = {
    id: string;
    code: string;
    commission_pct: number;
    commission_config_override: unknown;
    event: {
      id: string;
      slug: string;
      title: string;
      starts_at: string;
      venue: string | null;
      organization_id: string;
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

  // Resolve commission scheme: per-event override > org default. Falls back to
  // "percentage" for legacy links without an org_promoter row.
  const commissionType: CommissionType = link.org_promoter?.commission_type ?? "percentage";
  const overrideCfg = coerceCommissionConfig(commissionType, link.commission_config_override);
  const baseCfg = link.org_promoter
    ? coerceCommissionConfig(commissionType, link.org_promoter.commission_config)
    : null;
  const commissionConfig = overrideCfg ?? baseCfg;
  const commissionPct =
    link.commission_pct ?? link.org_promoter?.default_commission_pct ?? 0;

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

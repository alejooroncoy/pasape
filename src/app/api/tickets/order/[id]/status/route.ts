import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { signTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import { signOrderLink, verifyOrderLink } from "@/server/notifications/domain/OrderLinkToken";

const digitsOnly = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  return d.length > 0 ? d : null;
};

// Polling endpoint used by /events/[slug]/processing. Returns
// { status, paidAt, ticketUrl?, ticketsCount }.
// Authorization: buyer logueado, token firmado ?k= (desde checkout), o guest
// logueado cuyo email/tel coincide con la orden (para reclamar post-pago).
export const GET = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const orderToken = url.searchParams.get("k");

  const db = supabaseAdmin();
  const { data: row, error } = await db
    .from("orders")
    .select("id, status, paid_at, total_cents, buyer_id, guest_email, guest_phone, claimed_at")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: string;
      paid_at: string | null;
      total_cents: number;
      buyer_id: string;
      guest_email: string | null;
      guest_phone: string | null;
      claimed_at: string | null;
    }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const auth = await getAuthContext();
  const authEmail = auth.ok ? auth.value.email?.toLowerCase() ?? null : null;
  const isOwner = auth.ok && auth.value.profileId === row.buyer_id;
  const hasOrderToken = !!orderToken && verifyOrderLink(id, orderToken);

  let authPhone: string | null = null;
  if (auth.ok) {
    const { data: prof } = await db
      .from("profiles")
      .select("phone")
      .eq("id", auth.value.profileId)
      .maybeSingle<{ phone: string | null }>();
    authPhone = digitsOnly(prof?.phone);
  }
  const orderGuestPhone = digitsOnly(row.guest_phone);
  const phoneMatchesGuest =
    !!authPhone && !!orderGuestPhone && authPhone === orderGuestPhone;

  const canClaimGuestOrder =
    auth.ok &&
    row.status === "paid" &&
    !row.claimed_at &&
    ((!!row.guest_email &&
      !!authEmail &&
      authEmail === row.guest_email.toLowerCase()) ||
      phoneMatchesGuest);

  if (!isOwner && !canClaimGuestOrder && !hasOrderToken) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let ticketUrl: string | null = null;
  let orderUrl: string | null = null;
  let ticketsCount = 0;
  if (row.status === "paid") {
    const { data: tickets } = await db
      .from("tickets")
      .select("id, created_at")
      .eq("order_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    ticketsCount = tickets?.length ?? 0;
    const first = tickets?.[0];
    if (first) {
      const token = signTicketLink(first.id);
      ticketUrl = `/t/${first.id}?k=${token}`;
    }
    // /order es el único punto de decisión post-pago (ver processing/page.tsx):
    // reclama con el conteo real (o confirma que la orden ya es tuya, idempotente
    // en claimOrder) y recién ahí bifurca a /done o /tickets/[id]. Se devuelve
    // para todos — invitado y dueño logueado — para que nadie decida el destino
    // con datos adivinados.
    orderUrl = `/order/${id}/${signOrderLink(id)}${row.total_cents === 0 ? "?free=1" : ""}`;
  }

  return NextResponse.json({
    data: {
      status: row.status,
      paidAt: row.paid_at,
      ticketUrl,
      orderUrl,
      ticketsCount,
    },
  });
};

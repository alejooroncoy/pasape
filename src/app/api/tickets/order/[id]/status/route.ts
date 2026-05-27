import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { signTicketLink } from "@/server/notifications/domain/TicketLinkToken";

// Polling endpoint used by /events/[slug]/processing. Returns
// { status, paidAt, ticketUrl?, ticketsCount }.
// Authorization: owner is the logged-in buyer OR a guest passing ?email=.
// Cuando el pago está paid, también devolvemos `ticketUrl` con el primer
// ticket firmado para que el guest pueda ver su QR sin login.
export const GET = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase() ?? null;

  const db = supabaseAdmin();
  const { data: row, error } = await db
    .from("orders")
    .select("id, status, paid_at, buyer_id, guest_email")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: string;
      paid_at: string | null;
      buyer_id: string;
      guest_email: string | null;
    }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const auth = await getAuthContext();
  const isOwner = auth.ok && auth.value.profileId === row.buyer_id;
  const isGuest = email && row.guest_email && row.guest_email.toLowerCase() === email;
  if (!isOwner && !isGuest) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let ticketUrl: string | null = null;
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
  }

  return NextResponse.json({
    data: {
      status: row.status,
      paidAt: row.paid_at,
      ticketUrl,
      ticketsCount,
    },
  });
};

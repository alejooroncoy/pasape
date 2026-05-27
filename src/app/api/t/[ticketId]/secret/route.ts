import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { verifyTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import { WINDOW_SECONDS } from "@/server/tickets/domain/RotatingQr";
import { getAuthContext } from "@/server/_shared/AuthContext";

// Why: en vez de pollear `/rotating` cada 10s, entregamos el secret UNA vez
// al browser (TTL 30min). El browser computa HMAC localmente con Web Crypto
// API. Ahorra ~180x req/hora en eventos con cientos de viewers simultáneos.
// El secret nunca toca otro endpoint público que no sea este.

type TicketRow = {
  id: string;
  status: string;
  rotation_secret: string;
  current_holder: string;
};

const SECRET_TTL_MS = 30 * 60 * 1000; // 30 min

export const GET = async (
  req: NextRequest,
  ctx: { params: Promise<{ ticketId: string }> },
) => {
  const { ticketId } = await ctx.params;
  const url = new URL(req.url);
  const k = url.searchParams.get("k");

  // Dual-auth: guest via ?k=<signed> OR holder logueado (session).
  const linkOk = !!k && verifyTicketLink(ticketId, k);
  let auth: Awaited<ReturnType<typeof getAuthContext>> | null = null;
  if (!linkOk) {
    auth = await getAuthContext();
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const db = supabaseAdmin();
  const { data: ticket } = await db
    .from("tickets")
    .select("id, status, rotation_secret, current_holder")
    .eq("id", ticketId)
    .maybeSingle<TicketRow>();
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (ticket.status !== "active") {
    return NextResponse.json({ error: "ticket_inactive" }, { status: 410 });
  }
  // Si entró por auth (no link), exigir que sea el current_holder.
  if (!linkOk && auth?.ok && ticket.current_holder !== auth.value.profileId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // bytea hex → base64 para Web Crypto importKey
  const hex = ticket.rotation_secret.startsWith("\\x")
    ? ticket.rotation_secret.slice(2)
    : ticket.rotation_secret;
  const secretB64 = Buffer.from(hex, "hex").toString("base64");

  return NextResponse.json({
    data: {
      ticketId: ticket.id,
      secretB64,
      validUntil: Date.now() + SECRET_TTL_MS,
      windowSeconds: WINDOW_SECONDS,
      codeLength: 12,
    },
  });
};

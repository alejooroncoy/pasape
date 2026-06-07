import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { JWK } from "jose";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { verifyTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import { WINDOW_SECONDS } from "@/server/tickets/domain/RotatingQr";
import { signTicketCert } from "@/server/tickets/domain/EventSignature";
import { getOrCreateEventSigningKeys } from "@/server/tickets/application/EventSigningKeys";
import { getAuthContext } from "@/server/_shared/AuthContext";

// Why: validación offline asimétrica. El device genera un par ECDSA NO-extraíble
// y registra su PÚBLICA aquí (POST). El server firma un certificado con la
// privada del evento que liga esa pública al ticket+evento, y lo devuelve. El
// device guarda el cert y genera QRs rotativos firmados 100% offline. La privada
// del ticket nunca llega al server (a diferencia del HMAC simétrico anterior).

type TicketRow = {
  id: string;
  status: string;
  current_holder: string;
  holder_name: string | null;
  holder_dni_last2: string | null;
  ticket_type_id: string;
  ticket_types: { event_id: string; zone_id: string | null } | null;
};

export const POST = async (
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

  let body: { publicJwk?: JWK };
  try {
    body = (await req.json()) as { publicJwk?: JWK };
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const publicJwk = body.publicJwk;
  if (!publicJwk || publicJwk.kty !== "EC" || publicJwk.crv !== "P-256") {
    return NextResponse.json({ error: "invalid_public_key" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: ticket } = await db
    .from("tickets")
    .select(
      "id, status, current_holder, holder_name, holder_dni_last2, ticket_type_id, ticket_types(event_id, zone_id)",
    )
    .eq("id", ticketId)
    .maybeSingle<TicketRow>();
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (ticket.status !== "active") {
    return NextResponse.json({ error: "ticket_inactive" }, { status: 410 });
  }
  if (!linkOk && auth?.ok && ticket.current_holder !== auth.value.profileId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const eventId = ticket.ticket_types?.event_id;
  if (!eventId) {
    return NextResponse.json({ error: "event_not_found" }, { status: 404 });
  }

  const keys = await getOrCreateEventSigningKeys(db, eventId);
  const cert = await signTicketCert(keys.privateJwk, {
    ticketId: ticket.id,
    holderName: ticket.holder_name,
    dniLast2: ticket.holder_dni_last2,
    zoneId: ticket.ticket_types?.zone_id ?? null,
    ticketPub: publicJwk,
  });

  // Persistimos cert + pública del ticket (server-side, para auditoría/dashboard).
  await db
    .from("tickets")
    .update({ signing_cert: cert, signing_pub: publicJwk })
    .eq("id", ticket.id);

  return NextResponse.json({
    data: { ticketId: ticket.id, cert, windowSeconds: WINDOW_SECONDS },
  });
};

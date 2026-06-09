import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { JWK } from "jose";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { verifyTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import { WINDOW_SECONDS } from "@/lib/tickets/signedQr";
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
  const { data: ticket, error: ticketErr } = await db
    .from("tickets")
    .select(
      "id, status, current_holder, holder_name, holder_dni_last2, ticket_type_id, ticket_types(event_id, zone_id)",
    )
    .eq("id", ticketId)
    .maybeSingle<TicketRow>();
  // Why: antes el error del select se ignoraba y un fallo de query (ej. relación
  // PostgREST rota, columna faltante) se enmascaraba como 404. Ahora lo
  // diferenciamos: error real → 500 reportado a Sentry; fila ausente → 404.
  if (ticketErr) {
    Sentry.captureException(ticketErr, {
      tags: { route: "ticket-secret" },
      extra: { ticketId, op: "select_ticket" },
    });
    console.error("[ticket-secret] ticket select failed:", ticketErr.message);
    return NextResponse.json({ error: "ticket_lookup_failed" }, { status: 500 });
  }
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

  // Firma del cert: si las llaves del evento o la firma fallan, lo reportamos
  // como 500 con causa real (antes podía caer en un 500 genérico sin contexto).
  let cert: string;
  try {
    const keys = await getOrCreateEventSigningKeys(db, eventId);
    cert = await signTicketCert(keys.privateJwk, {
      ticketId: ticket.id,
      holderName: ticket.holder_name,
      dniLast2: ticket.holder_dni_last2,
      zoneId: ticket.ticket_types?.zone_id ?? null,
      ticketPub: publicJwk,
    });
  } catch (e) {
    Sentry.captureException(e, {
      tags: { route: "ticket-secret" },
      extra: { ticketId: ticket.id, eventId, op: "sign_cert" },
    });
    console.error("[ticket-secret] cert signing failed:", (e as Error).message);
    return NextResponse.json({ error: "cert_signing_failed" }, { status: 500 });
  }

  // Persistimos cert + pública del ticket (server-side, para auditoría/dashboard).
  await db
    .from("tickets")
    .update({ signing_cert: cert, signing_pub: publicJwk })
    .eq("id", ticket.id);

  return NextResponse.json({
    data: { ticketId: ticket.id, cert, windowSeconds: WINDOW_SECONDS },
  });
};

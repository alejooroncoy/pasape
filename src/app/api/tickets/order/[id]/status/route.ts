import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { signTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import { signOrderLink, verifyOrderLink } from "@/server/notifications/domain/OrderLinkToken";

// Polling endpoint used by /events/[slug]/processing. Returns
// { status, paidAt, ticketUrl?, ticketsCount }.
// Authorization: owner is the logged-in buyer, un guest passing ?email=, o
// quien porta el token firmado de la orden (?k=). El token (HMAC de la orden)
// es la llave que el cliente recibió al crear la compra: sin él, un guest que
// paga con Yape sin email no podía leer su propio estado (403) y terminaba en
// una pantalla de "no pudimos cobrarte" pese al pago aprobado.
// Cuando el pago está paid, también devolvemos `ticketUrl` con el primer
// ticket firmado para que el guest pueda ver su QR sin login.
export const GET = async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase() ?? null;
  const orderToken = url.searchParams.get("k");

  const db = supabaseAdmin();
  const { data: row, error } = await db
    .from("orders")
    .select("id, status, paid_at, total_cents, buyer_id, guest_email, claimed_at")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: string;
      paid_at: string | null;
      total_cents: number;
      buyer_id: string;
      guest_email: string | null;
      claimed_at: string | null;
    }>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const auth = await getAuthContext();
  const authEmail = auth.ok ? auth.value.email?.toLowerCase() ?? null : null;
  const isOwner = auth.ok && auth.value.profileId === row.buyer_id;
  const isGuest = email && row.guest_email && row.guest_email.toLowerCase() === email;
  // Portador del token firmado de ESTA orden (llave que el cliente ya posee
  // desde que creó la compra). Solo autoriza leer el estado de su propia orden.
  const hasOrderToken = !!orderToken && verifyOrderLink(id, orderToken);
  // Compra de invitado aún no reclamada: el logueado puede obtener el link de
  // desbloqueo (p. ej. aterrizó en /done tras Google en vez de /order) SOLO si
  // inició sesión con el mismo correo de la compra. Sin la coincidencia de email,
  // cualquier usuario logueado que conociera el UUID de la orden podría llevarse
  // el orderUrl firmado y apropiarse de las entradas (IDOR).
  const canClaimGuestOrder =
    auth.ok &&
    !!row.guest_email &&
    !row.claimed_at &&
    row.status === "paid" &&
    !!authEmail &&
    authEmail === row.guest_email.toLowerCase();
  if (!isOwner && !isGuest && !canClaimGuestOrder && !hasOrderToken) {
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

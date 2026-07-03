import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { verifyTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import { signOrderLink } from "@/server/notifications/domain/OrderLinkToken";

type Props = {
  params: Promise<{ locale: string; ticketId: string }>;
  searchParams: Promise<{ k?: string }>;
};

// Ruta legada de "ver entrada por link sin login". En el modelo de una sola
// página ya NO muestra el QR: el dueño logueado va a su billetera; cualquier
// otro link (entregas viejas) se encauza al desbloqueo (entra + reclama tu
// compra). El QR vive solo en /tickets/[id], autenticado y offline.
export default async function PublicTicketPage({ params, searchParams }: Props) {
  const { locale, ticketId } = await params;
  const { k } = await searchParams;

  const db = supabaseAdmin();
  const { data: ticket } = await db
    .from("tickets")
    .select("id, current_holder, order_id")
    .eq("id", ticketId)
    .maybeSingle<{ id: string; current_holder: string | null; order_id: string | null }>();
  if (!ticket) notFound();

  // Dueño logueado → su página autenticada (QR, carrusel, enviar, cambiar datos).
  const auth = await getAuthContext();
  if (auth.ok && ticket.current_holder && ticket.current_holder === auth.value.profileId) {
    redirect(`/${locale}/tickets/${ticketId}`);
  }

  // No dueño → exige la llave del link y lo encauza al desbloqueo de la compra.
  if (!k || !verifyTicketLink(ticketId, k)) notFound();
  if (ticket.order_id) {
    redirect(`/${locale}/order/${ticket.order_id}/${signOrderLink(ticket.order_id)}`);
  }
  // Sin orden (caso raro) → login hacia la billetera.
  redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/tickets/${ticketId}`)}`);
}

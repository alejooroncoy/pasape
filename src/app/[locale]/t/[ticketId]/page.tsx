import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { verifyTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import { TicketView } from "./TicketView";

type Props = {
  params: Promise<{ locale: string; ticketId: string }>;
  searchParams: Promise<{ k?: string }>;
};

type TicketRow = {
  id: string;
  status: string;
  holder_name: string | null;
  holder_email: string | null;
  box_label: string | null;
  box_host_ticket_id: string | null;
  ticket_type: { name: string; unit_noun: string | null; capacity: number } | null;
  order: {
    event: {
      slug: string;
      title: string;
      starts_at: string;
      venue: string | null;
      venue_url: string | null;
      timezone: string;
      cover_url: string | null;
    } | null;
  } | null;
};

export default async function PublicTicketPage({ params, searchParams }: Props) {
  const { ticketId } = await params;
  const { k } = await searchParams;
  if (!k || !verifyTicketLink(ticketId, k)) notFound();

  const db = supabaseAdmin();
  const { data: ticket } = await db
    .from("tickets")
    .select(
      "id, status, holder_name, holder_email, box_label, box_host_ticket_id, ticket_type:ticket_types(name, unit_noun, capacity), order:orders(event:events(slug, title, starts_at, venue, venue_url, timezone, cover_url))",
    )
    .eq("id", ticketId)
    .maybeSingle<TicketRow>();
  if (!ticket) notFound();

  const event = ticket.order?.event ?? null;

  return (
    <TicketView
      ticketId={ticket.id}
      k={k}
      status={ticket.status}
      holderName={ticket.holder_name}
      holderEmail={ticket.holder_email}
      ticketTypeName={ticket.ticket_type?.name ?? "Entrada"}
      boxLabel={ticket.box_label}
      unitNoun={ticket.ticket_type?.unit_noun ?? null}
      boxCapacity={ticket.ticket_type?.capacity ?? null}
      isBoxHost={!!ticket.box_label && !ticket.box_host_ticket_id}
      event={event}
    />
  );
}

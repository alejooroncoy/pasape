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
  ticket_type: { name: string } | null;
  order: { event: { title: string; starts_at: string; venue: string | null; timezone: string } | null } | null;
};

export default async function PublicTicketPage({ params, searchParams }: Props) {
  const { ticketId } = await params;
  const { k } = await searchParams;
  if (!k || !verifyTicketLink(ticketId, k)) notFound();

  const db = supabaseAdmin();
  const { data: ticket } = await db
    .from("tickets")
    .select(
      "id, status, holder_name, holder_email, ticket_type:ticket_types(name), order:orders(event:events(title, starts_at, venue, timezone))",
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
      event={event}
    />
  );
}

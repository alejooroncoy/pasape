import type { TicketRepository } from "../ports/TicketRepository";

type Deps = { repo: TicketRepository };
export const getMyTickets = ({ repo }: Deps, buyerId: string) => repo.listMine(buyerId);
export const getMyTicketById = ({ repo }: Deps, ticketId: string, buyerId: string | null) =>
  repo.getById(ticketId, buyerId);

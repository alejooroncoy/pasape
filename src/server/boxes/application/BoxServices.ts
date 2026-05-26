import type { BoxRepository } from "../ports/BoxRepository";

type Deps = { repo: BoxRepository };

export const createBoxForTicket = (
  { repo }: Deps,
  input: { ticketId: string; ownerId: string; capacity: number },
) => repo.createForTicket(input);

export const getBoxByToken = ({ repo }: Deps, token: string) => repo.getByToken(token);

export const getBoxByTicket = (
  { repo }: Deps,
  ticketId: string,
  ownerId: string,
) => repo.getByTicketId(ticketId, ownerId);

export const joinBox = (
  { repo }: Deps,
  input: { token: string; profileId: string; holderName: string; holderDni: string | null },
) => repo.join(input);

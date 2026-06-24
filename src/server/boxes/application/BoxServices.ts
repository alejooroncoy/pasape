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
  input: { token: string; profileId: string; holderName: string; holderDni: string | null; holderPhone: string | null },
) => repo.join(input);

export const removeBoxMember = (
  { repo }: Deps,
  input: { token: string; ownerId: string; memberProfileId: string },
) => repo.removeMember(input);

export const addBoxCompanion = (
  { repo }: Deps,
  input: { token: string; ownerId: string; holderName: string; holderDni: string | null },
) => repo.addCompanion(input);

import type { IncentiveRepository } from "../ports/IncentiveRepository";

type Deps = { repo: IncentiveRepository };

export const listIncentivesForEvent = ({ repo }: Deps, eventId: string) =>
  repo.listForEvent(eventId);

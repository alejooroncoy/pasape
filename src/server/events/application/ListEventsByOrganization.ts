import type { EventRepository } from "../ports/EventRepository";

type Deps = { repo: EventRepository };

export const listEventsByOrganization = ({ repo }: Deps, orgId: string) =>
  repo.listByOrganization(orgId);

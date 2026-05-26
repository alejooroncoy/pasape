import type { EventRepository } from "../ports/EventRepository";

type Deps = { repo: EventRepository };

export const getEventBySlug = ({ repo }: Deps, slug: string) => repo.getBySlug(slug);

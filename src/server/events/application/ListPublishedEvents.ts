import type { EventCategory } from "../domain/Event";
import type { EventRepository } from "../ports/EventRepository";

type Deps = { repo: EventRepository };

export const listPublishedEvents = (
  { repo }: Deps,
  opts: { limit?: number; cursor?: string | null; category?: EventCategory | null } = {},
) => repo.listPublished(opts.limit ?? 50, opts.cursor ?? null, opts.category);

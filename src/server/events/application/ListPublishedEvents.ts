import type { EventCategory } from "../domain/Event";
import type { EventRepository } from "../ports/EventRepository";
import { BROWSE_EVENTS_LIMIT } from "@/lib/events/constants";

type Deps = { repo: EventRepository };

export const listPublishedEvents = (
  { repo }: Deps,
  opts: {
    limit?: number;
    cursor?: string | null;
    category?: EventCategory | null;
    search?: string | null;
  } = {},
) =>
  repo.listPublished(
    opts.limit ?? BROWSE_EVENTS_LIMIT,
    opts.cursor ?? null,
    opts.category,
    opts.search,
  );

import type { EventRepository, ScanFeedItem } from "../ports/EventRepository";

type Deps = { repo: EventRepository };

export const listEventAccesos = (
  { repo }: Deps,
  eventId: string,
  limit = 50,
): Promise<ScanFeedItem[]> => repo.listScans(eventId, limit);

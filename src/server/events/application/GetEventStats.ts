import type { EventRepository, EventStats, ScanFeedItem } from "../ports/EventRepository";

type Deps = { repo: EventRepository };

export const getEventStats = async (
  { repo }: Deps,
  eventId: string,
): Promise<EventStats & { scansRecent: ScanFeedItem[] }> => {
  const [stats, scansRecent] = await Promise.all([
    repo.getStats(eventId),
    repo.listScans(eventId, 10),
  ]);
  return { ...stats, scansRecent };
};

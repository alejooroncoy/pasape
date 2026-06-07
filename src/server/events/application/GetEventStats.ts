import type {
  DoorHealth,
  EventRepository,
  EventStats,
  ScanFeedItem,
} from "../ports/EventRepository";

type Deps = { repo: EventRepository };

export type EventStatsResult = EventStats & {
  scansRecent: ScanFeedItem[];
  doors: DoorHealth[];
  dupOffline: number;
};

export const getEventStats = async (
  { repo }: Deps,
  eventId: string,
): Promise<EventStatsResult> => {
  const [stats, scansRecent, health] = await Promise.all([
    repo.getStats(eventId),
    repo.listScans(eventId, 10),
    repo.getDoorHealth(eventId),
  ]);
  return { ...stats, scansRecent, doors: health.doors, dupOffline: health.dupOffline };
};

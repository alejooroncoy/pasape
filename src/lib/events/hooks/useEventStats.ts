"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type {
  DoorHealth,
  EventStats,
  ScanFeedItem,
} from "@/server/events/ports/EventRepository";

export type EventStatsPayload = EventStats & {
  scansRecent: ScanFeedItem[];
  doors: DoorHealth[];
  dupOffline: number;
};

export const useEventStats = (slug: string) =>
  useQuery({
    queryKey: ["events", "stats", slug],
    queryFn: () => api.get<EventStatsPayload>(`/api/events/${slug}/stats`),
    enabled: !!slug,
    refetchInterval: 15_000,
  });

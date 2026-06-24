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

// Sin polling: los KPIs se refrescan vía Broadcast desde la DB
// (useRealtimeEventStats) y postgres_changes de scans (useScanRealtime). Si
// Realtime no conecta, refetchOnWindowFocus/reconnect cubren el caso. Monta
// useRealtimeEventStats junto a este hook en cada pantalla que muestre stats.
export const useEventStats = (slug: string) =>
  useQuery({
    queryKey: ["events", "stats", slug],
    queryFn: () => api.get<EventStatsPayload>(`/api/events/${slug}/stats`),
    enabled: !!slug,
  });

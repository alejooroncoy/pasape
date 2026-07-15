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

// Sin polling: los KPIs (incluidos los scans en puerta) se refrescan vía
// Broadcast desde la DB (useRealtimeEventStats), que escucha tanto orders
// como scan_events (trigger scan_events_broadcast_stats). Si Realtime no
// conecta, refetchOnWindowFocus/reconnect cubren el caso. Monta
// useRealtimeEventStats junto a este hook en cada pantalla que muestre stats.
export const useEventStats = (slug: string) =>
  useQuery({
    queryKey: ["events", "stats", slug],
    queryFn: () => api.get<EventStatsPayload>(`/api/events/${slug}/stats`),
    enabled: !!slug,
  });

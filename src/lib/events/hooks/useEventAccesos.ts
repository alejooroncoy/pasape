"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { ScanFeedItem } from "@/server/events/ports/EventRepository";

export const useEventAccesos = (slug: string) =>
  useQuery({
    queryKey: ["events", "accesos", slug],
    queryFn: () => api.get<ScanFeedItem[]>(`/api/events/${slug}/team`),
    enabled: !!slug,
    refetchInterval: 10_000,
  });

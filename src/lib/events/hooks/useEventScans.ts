"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { ScanFeedItem } from "@/server/events/ports/EventRepository";

export const useEventScans = (slug: string) =>
  useQuery({
    queryKey: ["events", "scans", slug],
    queryFn: () => api.get<ScanFeedItem[]>(`/api/events/${slug}/scans`),
    enabled: !!slug,
  });

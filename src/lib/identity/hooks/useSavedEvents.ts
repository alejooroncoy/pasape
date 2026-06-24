"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { SavedEvent } from "@/server/events/application/ListSavedEvents";

export const savedEventsKey = ["identity", "saved-events"] as const;

export const useSavedEvents = () =>
  useQuery({
    queryKey: savedEventsKey,
    queryFn: () => api.get<SavedEvent[]>("/api/identity/saved-events"),
  });

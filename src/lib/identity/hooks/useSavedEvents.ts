"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { SavedEvent } from "@/server/events/application/ListSavedEvents";
import { useSessionReady } from "./useSessionReady";

export const savedEventsKey = ["identity", "saved-events"] as const;

// Why: sin sesión no hay favoritos que traer — pedirlo igual solo genera un
// 401 ruidoso en cada visita anónima (la mayoría del tráfico de la home).
export const useSavedEvents = () => {
  const { sessionReady, loggedIn } = useSessionReady();
  return useQuery({
    queryKey: savedEventsKey,
    queryFn: () => api.get<SavedEvent[]>("/api/identity/saved-events"),
    enabled: sessionReady && loggedIn,
  });
};

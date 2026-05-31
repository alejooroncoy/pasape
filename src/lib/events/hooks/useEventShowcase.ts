"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { EventOrgShowcase } from "@/server/events/application/GetEventOrgShowcase";

/** Productora del evento + sus otros eventos (cross-sell en la landing). */
export const useEventShowcase = (slug: string) =>
  useQuery({
    queryKey: ["events", "showcase", slug],
    queryFn: () => api.get<EventOrgShowcase | null>(`/api/events/${slug}/showcase`),
    enabled: !!slug,
  });

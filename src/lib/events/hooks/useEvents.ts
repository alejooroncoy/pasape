"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Event, EventCategory, Promo, TicketType } from "@/server/events/domain/Event";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

export const useBrowseEvents = (category?: EventCategory | null) =>
  useQuery({
    queryKey: ["events", "browse", category ?? null],
    queryFn: () =>
      api.get<Event[]>(category ? `/api/events?category=${category}` : "/api/events"),
  });

export const useMyEvents = () => {
  const me = useCurrentUser();
  const hasOrg = !!me.data?.activeOrgSlug;
  return useQuery({
    queryKey: ["events", "mine", me.data?.activeOrgSlug ?? null],
    queryFn: () => api.get<Event[]>("/api/events?scope=mine"),
    enabled: hasOrg,
  });
};

export const useEvent = (slug: string) =>
  useQuery({
    queryKey: ["events", "detail", slug],
    queryFn: () =>
      api.get<{ event: Event; ticketTypes: TicketType[]; promos: Promo[] }>(
        `/api/events/${slug}`,
      ),
    enabled: !!slug,
  });

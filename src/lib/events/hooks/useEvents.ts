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

// orgSlugOverride: cuando el server ya resolvió la marca activa (prefetch híbrido),
// se pasa para arrancar sin esperar a useCurrentUser (evita el waterfall en cliente).
export const useMyEvents = (orgSlugOverride?: string | null) => {
  const me = useCurrentUser();
  const slug = orgSlugOverride ?? me.data?.activeOrgSlug ?? null;
  return useQuery({
    queryKey: ["events", "mine", slug],
    queryFn: () => api.get<Event[]>("/api/events?scope=mine"),
    enabled: !!slug,
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

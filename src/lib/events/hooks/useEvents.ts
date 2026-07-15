"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Event, EventCard, EventCategory, Promo, TicketType } from "@/server/events/domain/Event";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

// Listado público (home, carrusel, grid, categorías): payload liviano —
// `EventCard`, no el `Event` completo (ver EventsController.listPublic).
export const useBrowseEvents = (category?: EventCategory | null) =>
  useQuery({
    queryKey: ["events", "browse", category ?? null],
    queryFn: () =>
      api.get<EventCard[]>(category ? `/api/events?category=${category}` : "/api/events"),
  });

// Búsqueda del header contra el backend (ilike por título/lugar con índices
// trigram). El debounce vive en el componente; aquí solo se consulta cuando el
// término ya estabilizó y tiene 2+ caracteres. Mismo payload liviano que browse.
export const useSearchEvents = (query: string) => {
  const q = query.trim();
  return useQuery({
    queryKey: ["events", "search", q],
    queryFn: () => api.get<EventCard[]>(`/api/events?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
};

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

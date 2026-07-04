"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { CourtesySummary } from "@/server/tickets/ports/TicketRepository";

export const courtesiesKey = (slug: string) =>
  ["events", slug, "courtesies"] as const;

export const useCourtesies = (slug: string) =>
  useQuery({
    queryKey: courtesiesKey(slug),
    queryFn: () => api.get<CourtesySummary[]>(`/api/events/${slug}/courtesies`),
    enabled: !!slug,
  });

export const useSendCourtesy = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      ticketTypeId: string;
      qty: number;
      guest: { fullName: string; email?: string | null; phone?: string | null };
    }) => api.post<{ orderId: string }>(`/api/events/${slug}/courtesies`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courtesiesKey(slug) });
      // La cortesía consume stock y suma al conteo de entradas del evento.
      qc.invalidateQueries({ queryKey: ["events", "stats", slug] });
    },
  });
};

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Event, EventCategory } from "@/server/events/domain/Event";

export type CreateEventInput = {
  title: string;
  description?: string | null;
  category?: EventCategory | null;
  venue?: string | null;
  venueLat?: number | null;
  venueLng?: number | null;
  venueUrl?: string | null;
  venueSource?: "manual" | "google" | "apple" | null;
  venueLayoutUrl?: string | null;
  coverUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  timezone?: string;
  totalCapacity?: number | null;
  overbookPct?: number;
  transfersEnabled?: boolean;
  transferDeadlineHours?: number | null;
  transferMaxCount?: number;
  transferRequiresKyc?: boolean;
  ticketTypes: Array<{
    name: string;
    kind?: "general" | "box";
    priceCents: number;
    capacity: number;
    boxLabel?: string | null;
    unitNoun?: string | null;
  }>;
};

export const useCreateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => api.post<Event>("/api/events", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", "mine"] });
      qc.invalidateQueries({ queryKey: ["events", "browse"] });
    },
  });
};

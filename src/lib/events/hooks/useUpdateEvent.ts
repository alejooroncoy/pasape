"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Event } from "@/server/events/domain/Event";
import type { UpdateEventInput } from "@/server/events/ports/EventRepository";

export const useUpdateEvent = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEventInput) => api.patch<Event>(`/api/events/${slug}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", "detail", slug] });
      qc.invalidateQueries({ queryKey: ["events", "mine"] });
      qc.invalidateQueries({ queryKey: ["events", "stats", slug] });
    },
  });
};

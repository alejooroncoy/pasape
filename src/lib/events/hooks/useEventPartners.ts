"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { EventPartner } from "@/server/events/application/EventPartners";

export const eventPartnersKey = (slug: string) =>
  ["events", slug, "partners"] as const;

export const useEventPartners = (slug: string) =>
  useQuery({
    queryKey: eventPartnersKey(slug),
    queryFn: () => api.get<EventPartner[]>(`/api/events/${slug}/partners`),
  });

export const useAddEventPartner = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; logoUrl?: string | null; websiteUrl?: string | null }) =>
      api.post<EventPartner>(`/api/events/${slug}/partners`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventPartnersKey(slug) });
    },
  });
};

export const useRemoveEventPartner = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partnerId: string) =>
      api.del<null>(`/api/events/${slug}/partners/${partnerId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventPartnersKey(slug) });
    },
  });
};

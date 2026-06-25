"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Zone } from "@/server/events/domain/Zone";

const key = (slug: string) => ["events", "zones", slug];

export const useZones = (slug: string) =>
  useQuery({
    queryKey: key(slug),
    queryFn: () => api.get<Zone[]>(`/api/events/${slug}/zones`),
    enabled: !!slug,
  });

export const useCreateZone = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      ticketTypeIds: string[];
      isDefault?: boolean;
    }) => api.post<Zone>(`/api/events/${slug}/zones`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(slug) }),
  });
};

export const useUpdateZone = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      zoneId,
      ...input
    }: {
      zoneId: string;
      name?: string;
      ticketTypeIds?: string[];
    }) => api.patch<Zone>(`/api/events/${slug}/zones/${zoneId}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(slug) }),
  });
};

export const useDeleteZone = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) =>
      api.del<{ id: string }>(`/api/events/${slug}/zones/${zoneId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(slug) }),
  });
};

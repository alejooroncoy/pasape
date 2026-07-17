"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { EventCoOrganizer } from "@/server/events/application/EventCoOrganizers";

export const eventCoOrganizersKey = (slug: string) =>
  ["events", slug, "co-organizers"] as const;

export const useEventCoOrganizers = (slug: string) =>
  useQuery({
    queryKey: eventCoOrganizersKey(slug),
    queryFn: () => api.get<EventCoOrganizer[]>(`/api/events/${slug}/co-organizers`),
  });

export const useAddEventCoOrganizer = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) =>
      api.post<{ profileId: string }>(`/api/events/${slug}/co-organizers`, {
        profileId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventCoOrganizersKey(slug) });
    },
  });
};

export const useInviteEventCoOrganizer = (slug: string) =>
  useMutation({
    mutationFn: (email: string) =>
      api.post<{ inviteId: string }>(`/api/events/${slug}/co-organizers/invite`, {
        email,
      }),
  });

export const useRemoveEventCoOrganizer = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) =>
      api.del<{ profileId: string }>(
        `/api/events/${slug}/co-organizers/${profileId}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventCoOrganizersKey(slug) });
    },
  });
};

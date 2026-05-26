"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { DoorLink } from "@/server/events/application/GenerateDoorLink";

export const useDoorLink = (slug: string) =>
  useQuery({
    queryKey: ["events", "door-link", slug],
    queryFn: () => api.get<DoorLink>(`/api/events/${slug}/door-link`),
    enabled: !!slug,
  });

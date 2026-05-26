"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Event } from "@/server/events/domain/Event";
import type { Organization } from "@/server/identity/organizations/domain/Organization";

export const useOrgBySlug = (slug: string) =>
  useQuery({
    queryKey: ["organizations", "by-slug", slug],
    queryFn: () => api.get<Organization>(`/api/organizations/${slug}`),
    enabled: !!slug,
  });

export const useOrgEvents = (slug: string) =>
  useQuery({
    queryKey: ["organizations", "events", slug],
    queryFn: () => api.get<Event[]>(`/api/organizations/${slug}/events`),
    enabled: !!slug,
  });

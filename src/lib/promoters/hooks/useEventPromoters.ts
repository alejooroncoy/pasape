"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { EventPromoterAssignment } from "@/server/promoters/application/EventPromoterAssignment";
import type { PromoterLinkSale } from "@/server/promoters/application/PromoterDetail";

const key = (slug: string) => ["promoters", "event", slug] as const;

export const useEventPromoters = (slug: string) =>
  useQuery({
    queryKey: key(slug),
    queryFn: () => api.get<EventPromoterAssignment[]>(`/api/events/${slug}/promoters`),
    enabled: !!slug,
  });

export const useAssignPromotersToEvent = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgPromoterIds: string[]) =>
      api.post<EventPromoterAssignment[]>(`/api/events/${slug}/promoters`, { orgPromoterIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(slug) });
      qc.invalidateQueries({ queryKey: ["events", "stats", slug] });
    },
  });
};

export const useUpdateAssignmentCommission = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      linkId,
      commissionPct,
      quota,
    }: {
      linkId: string;
      commissionPct?: number;
      quota?: number | null;
    }) => {
      const body: Record<string, unknown> = {};
      if (commissionPct !== undefined) body.commissionPct = commissionPct;
      if (quota !== undefined) body.quota = quota;
      return api.patch<true>(`/api/events/${slug}/promoters/${linkId}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(slug) }),
  });
};

export const usePromoterLinkSales = (slug: string, linkId: string) =>
  useQuery({
    queryKey: ["promoters", "event", slug, "link", linkId, "sales"] as const,
    queryFn: () => api.get<PromoterLinkSale[]>(`/api/events/${slug}/promoters/${linkId}/sales`),
    enabled: !!slug && !!linkId,
  });

export const useRemoveAssignment = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => api.del<true>(`/api/events/${slug}/promoters/${linkId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(slug) });
      qc.invalidateQueries({ queryKey: ["events", "stats", slug] });
    },
  });
};

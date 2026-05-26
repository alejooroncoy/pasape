"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type {
  PromoterApplication,
  PromoterEventEarning,
  PromoterHomeData,
  PromoterLink,
} from "@/server/promoters/domain/Promoter";

export const useMyPromoterLinks = () =>
  useQuery({
    queryKey: ["promoters", "links"],
    queryFn: () => api.get<PromoterLink[]>("/api/promoters/links"),
  });

export const usePromoterHome = (slug: string) =>
  useQuery({
    queryKey: ["promoters", "home", slug],
    queryFn: () => api.get<PromoterHomeData>(`/api/promoters/home/${slug}`),
    enabled: !!slug,
  });

export const useMyEarnings = () =>
  useQuery({
    queryKey: ["promoters", "earnings"],
    queryFn: () => api.get<PromoterEventEarning[]>("/api/promoters/earnings"),
  });

export const useGenerateInvite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { eventSlug: string; commissionPct?: number }) =>
      api.post<{ token: string; url: string }>("/api/promoters/invite", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promoters"] }),
  });
};

export const useResolveInvite = (token: string) =>
  useQuery({
    queryKey: ["promoters", "invite", token],
    queryFn: () =>
      api.get<{
        eventId: string;
        eventSlug: string;
        eventTitle: string;
        commissionPct: number;
        orgName: string;
      }>(`/api/promoters/invite/${token}`),
    enabled: !!token,
  });

export const useApplyByLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; message?: string | null }) =>
      api.post<{ applicationId: string; eventSlug: string }>("/api/promoters/apply", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promoters"] }),
  });
};

export const useApplicationStatus = (slug: string) =>
  useQuery({
    queryKey: ["promoters", "status", slug],
    queryFn: () =>
      api.get<{ status: "pending" | "approved" | "rejected" | "cancelled"; link: PromoterLink | null }>(
        `/api/promoters/status/${slug}`,
      ),
    enabled: !!slug,
    refetchInterval: 5000,
  });

export const usePendingApplications = (slug: string) =>
  useQuery({
    queryKey: ["promoters", "pending", slug],
    queryFn: () =>
      api.get<PromoterApplication[]>(`/api/promoters/applications?eventSlug=${encodeURIComponent(slug)}`),
    enabled: !!slug,
  });

export const useDecideApplication = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      applicationId: string;
      decision: "approved" | "rejected";
      commissionPct?: number;
    }) => api.patch<{ link: PromoterLink | null }>("/api/promoters/applications", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promoters", "pending", slug] }),
  });
};

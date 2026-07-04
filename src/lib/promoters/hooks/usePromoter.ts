"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";
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

/** Nombre público del promotor detrás de un código (chip del checkout / banner del evento). */
export const usePromoterDisplayName = (code: string | null) =>
  useQuery({
    queryKey: ["promoters", "display-name", code],
    queryFn: () => api.get<{ name: string }>(`/api/r/${encodeURIComponent(code!)}/name`),
    enabled: !!code,
    staleTime: 5 * 60_000,
    retry: false,
  });

export const usePromoterHome = (slug: string) =>
  useQuery({
    queryKey: ["promoters", "home", slug],
    queryFn: () => api.get<PromoterHomeData>(`/api/promoters/home/${slug}`),
    enabled: !!slug,
    // Realtime lo cubre useRealtimePromoterStats; esto es el fallback si el
    // Broadcast no conecta y al volver a la pestaña durante el evento.
    refetchOnWindowFocus: true,
  });

export const useMyEarnings = () =>
  useQuery({
    queryKey: ["promoters", "earnings"],
    queryFn: () => api.get<PromoterEventEarning[]>("/api/promoters/earnings"),
    // Agregado multi-evento (no atado a un eventId): polling ligero + refetch al
    // enfocar para que el promotor vea sus ganancias actualizarse.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
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
  });

// Realtime de solicitudes de promotor vía Broadcast desde la DB (trigger
// promoter_app_broadcast → topic `promoter-app:<slug>`). Reemplaza el polling:
// el ping no trae datos, solo dispara un refetch del estado (postulante) y de la
// lista de pendientes (organizador). Degrada vía refetchOnWindowFocus si Realtime
// no conecta. Un solo hook sirve a ambas pantallas porque comparten el slug.
export function useRealtimePromoterApplications(slug: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!slug) return;
    const supabase = createSupabaseBrowserClient();
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["promoters", "status", slug] });
      void qc.invalidateQueries({ queryKey: ["promoters", "pending", slug] });
    };
    const channel = supabase
      .channel(`promoter-app:${slug}`)
      .on("broadcast", { event: "application_changed" }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [slug, qc]);
}

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

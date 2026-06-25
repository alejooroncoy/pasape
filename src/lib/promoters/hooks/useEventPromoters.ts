"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { EventPromoterAssignment } from "@/server/promoters/application/EventPromoterAssignment";
import type { PromoterLinkSale } from "@/server/promoters/application/PromoterDetail";
import type { EventPromoterScheme } from "@/server/events/ports/EventRepository";
import type { CommissionConfig, CommissionType } from "@/server/promoters/domain/OrgPromoter";

const key = (slug: string) => ["promoters", "event", slug] as const;
const schemeKey = (slug: string) => ["promoters", "event", slug, "scheme"] as const;

export const useEventPromoterScheme = (slug: string) =>
  useQuery({
    queryKey: schemeKey(slug),
    queryFn: () => api.get<EventPromoterScheme>(`/api/events/${slug}/promoters/scheme`),
    enabled: !!slug,
  });

const EMPTY_SCHEME: EventPromoterScheme = {
  commissionPct: null,
  commissionType: null,
  commissionConfig: null,
  defaultQuota: null,
};

export const useUpdateEventPromoterScheme = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<EventPromoterScheme>) =>
      api.patch<true>(`/api/events/${slug}/promoters/scheme`, patch),
    // Optimista: pinta el cambio al instante; el viaje a Supabase (~2s) no se nota.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: schemeKey(slug) });
      const prev = qc.getQueryData<EventPromoterScheme>(schemeKey(slug));
      qc.setQueryData<EventPromoterScheme>(schemeKey(slug), {
        ...(prev ?? EMPTY_SCHEME),
        ...patch,
      });
      return { prev };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(schemeKey(slug), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: schemeKey(slug) });
      // Los efectivos de cada promotor pueden cambiar al mover el default.
      qc.invalidateQueries({ queryKey: key(slug) });
    },
  });
};

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

type AssignmentEdit = {
  linkId: string;
  commissionPct?: number | null;
  commissionType?: CommissionType | null;
  commissionConfig?: CommissionConfig | null;
  quota?: number | null;
};

export const useUpdateAssignmentCommission = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      linkId,
      commissionPct,
      commissionType,
      commissionConfig,
      quota,
    }: AssignmentEdit) => {
      const body: Record<string, unknown> = {};
      if (commissionPct !== undefined) body.commissionPct = commissionPct;
      if (commissionType !== undefined) body.commissionType = commissionType;
      if (commissionConfig !== undefined) body.commissionConfig = commissionConfig;
      if (quota !== undefined) body.quota = quota;
      return api.patch<true>(`/api/events/${slug}/promoters/${linkId}`, body);
    },
    // Optimista: actualiza el promotor editado al toque (valor propio + marca de
    // personalizado). Al resetear a null el efectivo real lo corrige el refetch.
    onMutate: async (edit) => {
      await qc.cancelQueries({ queryKey: key(slug) });
      const prev = qc.getQueryData<EventPromoterAssignment[]>(key(slug));
      qc.setQueryData<EventPromoterAssignment[]>(key(slug), (old) =>
        (old ?? []).map((a) => {
          if (a.promoterLinkId !== edit.linkId) return a;
          const next = { ...a };
          if (edit.commissionPct !== undefined) {
            next.ownCommissionPct = edit.commissionPct;
            if (edit.commissionPct != null) next.effectiveCommissionPct = edit.commissionPct;
          }
          if (edit.commissionType !== undefined) {
            next.ownCommissionType = edit.commissionType;
            if (edit.commissionType != null) next.commissionType = edit.commissionType;
          }
          if (edit.commissionConfig !== undefined) {
            next.ownCommissionConfig = edit.commissionConfig;
          }
          // Comisión personalizada si tiene cualquier override propio.
          next.commissionCustom =
            next.ownCommissionPct != null ||
            next.ownCommissionType != null ||
            next.ownCommissionConfig != null;
          if (edit.quota !== undefined) {
            next.ownQuota = edit.quota;
            next.quotaCustom = edit.quota != null;
            // -1 = personalizado a "sin tope" → efectivo null.
            if (edit.quota != null) next.effectiveQuota = edit.quota === -1 ? null : edit.quota;
          }
          return next;
        }),
      );
      return { prev };
    },
    onError: (_e, _edit, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key(slug), ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key(slug) }),
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

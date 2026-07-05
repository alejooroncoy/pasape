"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { CommissionConfig, OrgPromoter } from "@/server/promoters/domain/OrgPromoter";
import type { PromoterDetail } from "@/server/promoters/application/PromoterDetail";
import type { OrgScheme } from "@/server/promoters/controllers/rest/OrgPromotersController";

const KEY = ["promoters", "org-pool"] as const;
const SCHEME_KEY = ["promoters", "org-scheme"] as const;

// Regla base de la marca: % + metas que heredan TODOS los promotores y eventos.
export const useOrgScheme = () =>
  useQuery({
    queryKey: SCHEME_KEY,
    queryFn: () => api.get<OrgScheme>("/api/org/promoters/scheme"),
  });

export type OrgSchemePatch = {
  commissionPct?: number | null;
  commissionConfig?: CommissionConfig | null;
};

export const useUpdateOrgScheme = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: OrgSchemePatch) => api.patch<true>("/api/org/promoters/scheme", patch),
    // El cambio de marca afecta la herencia en todos lados: invalida esquema +
    // pool + cualquier detalle de promotor.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCHEME_KEY });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
};

export const useOrgPromoters = () =>
  useQuery({
    queryKey: KEY,
    queryFn: () => api.get<OrgPromoter[]>("/api/org/promoters"),
  });

export type CreatePromoterPayload = {
  name: string;
  whatsapp: string | null;
  /** % por venta. null = hereda de la marca; 0 = sin comisión. */
  defaultCommissionPct: number | null;
  /** Metas (efectivo/especie por umbral). Independiente del %. */
  commissionConfig?: CommissionConfig;
  notes?: string | null;
};

export const useCreateOrgPromoter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePromoterPayload) =>
      api.post<OrgPromoter>("/api/org/promoters", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export type UpdatePromoterPayload = Partial<CreatePromoterPayload>;

export const useUpdateOrgPromoter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePromoterPayload }) =>
      api.patch<OrgPromoter>(`/api/org/promoters/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useOrgPromoterDetail = (id: string) =>
  useQuery({
    queryKey: ["promoters", "org-pool", id, "detail"] as const,
    queryFn: () => api.get<PromoterDetail>(`/api/org/promoters/${id}/detail`),
    enabled: !!id,
    // Durante la noche del evento los KPIs cambian: refresca por intervalo y al
    // volver a la pestaña para que no queden congelados.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

export const useDeleteOrgPromoter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<true>(`/api/org/promoters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

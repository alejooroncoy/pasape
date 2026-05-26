"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type {
  CommissionConfig,
  CommissionType,
  OrgPromoter,
} from "@/server/promoters/domain/OrgPromoter";
import type { PromoterDetail } from "@/server/promoters/application/PromoterDetail";

const KEY = ["promoters", "org-pool"] as const;

export const useOrgPromoters = () =>
  useQuery({
    queryKey: KEY,
    queryFn: () => api.get<OrgPromoter[]>("/api/org/promoters"),
  });

export type CreatePromoterPayload = {
  name: string;
  whatsapp: string | null;
  defaultCommissionPct: number;
  /** Defaults server-side to "percentage" when omitted. */
  commissionType?: CommissionType;
  /** Required when `commissionType` is "tiered" or "inkind". */
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
  });

export const useDeleteOrgPromoter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<true>(`/api/org/promoters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

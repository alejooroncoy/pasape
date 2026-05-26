"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { CommissionTier } from "@/server/promoters/tiers/domain/CommissionTier";

export type CreateTierInput = {
  thresholdCount: number;
  rewardKind: "cash" | "bottle" | "custom";
  rewardAmountCents?: number | null;
  rewardLabel: string;
};

export type UpdateTierInput = Partial<CreateTierInput>;

const key = (linkId: string) => ["commission-tiers", linkId];

export const useCommissionTiers = (linkId: string | null | undefined) =>
  useQuery({
    queryKey: key(linkId ?? ""),
    queryFn: () => api.get<CommissionTier[]>(`/api/promoters/links/${linkId}/tiers`),
    enabled: !!linkId,
  });

export const useCreateCommissionTier = (linkId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTierInput) =>
      api.post<CommissionTier>(`/api/promoters/links/${linkId}/tiers`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(linkId) });
    },
  });
};

export const useUpdateCommissionTier = (linkId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tierId, ...input }: UpdateTierInput & { tierId: string }) =>
      api.patch<CommissionTier>(
        `/api/promoters/links/${linkId}/tiers/${tierId}`,
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(linkId) });
    },
  });
};

export const useDeleteCommissionTier = (linkId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tierId: string) =>
      api.del<{ id: string }>(`/api/promoters/links/${linkId}/tiers/${tierId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(linkId) });
    },
  });
};

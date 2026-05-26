"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Incentive } from "@/server/promoters/incentives/domain/Incentive";
import type { CreateIncentiveInput } from "@/server/promoters/incentives/ports/IncentiveRepository";

export type IncentiveWithUnlocks = Incentive & { unlockedCount: number };

export const useEventIncentives = (slug: string) =>
  useQuery({
    queryKey: ["incentives", slug],
    queryFn: () => api.get<IncentiveWithUnlocks[]>(`/api/events/${slug}/incentives`),
    enabled: !!slug,
  });

export const useCreateIncentive = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateIncentiveInput, "eventId">) =>
      api.post<Incentive>(`/api/events/${slug}/incentives`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incentives", slug] });
    },
  });
};

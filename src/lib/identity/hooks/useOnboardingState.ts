"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";

export const onboardingStateKey = ["identity", "onboarding-state"] as const;

type StateResponse = { completedTours: string[] };

export const useOnboardingState = () =>
  useQuery({
    queryKey: onboardingStateKey,
    queryFn: () => api.get<StateResponse>("/api/me/onboarding"),
    staleTime: 60_000,
  });

export const useCompleteTour = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tourId: string) =>
      api.post<StateResponse>("/api/me/onboarding/complete", { tourId }),
    onSuccess: (data) => {
      qc.setQueryData(onboardingStateKey, data);
    },
  });
};

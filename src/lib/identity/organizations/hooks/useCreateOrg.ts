"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { myOrgsKey } from "./useMyOrgs";
import { legalEntitiesKey } from "./useLegalEntities";

type Input = {
  name: string;
  slug?: string;
  legalEntityId?: string;
  newLegalEntity?: { name: string; taxId?: string | null; country?: string };
};
type Output = { id: string; slug: string };

export const useCreateOrg = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => api.post<Output>("/api/organizations", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myOrgsKey });
      qc.invalidateQueries({ queryKey: legalEntitiesKey });
    },
  });
};

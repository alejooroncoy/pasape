"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { legalEntitiesKey, type LegalEntity } from "./useLegalEntities";

type Input = {
  id: string;
  name?: string;
  taxId?: string | null;
  country?: string;
  slug?: string | null;
  displayName?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankCci?: string | null;
};

export const useUpdateLegalEntity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Input) =>
      api.patch<LegalEntity>(`/api/legal-entities/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: legalEntitiesKey }),
  });
};

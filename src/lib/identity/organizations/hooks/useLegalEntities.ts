"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";

export type LegalEntity = {
  id: string;
  name: string;
  taxId: string | null;
  country: string;
  slug: string | null;
  displayName: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankCci: string | null;
  createdBy: string;
  createdAt: string;
};

export const legalEntitiesKey = ["identity", "legalEntities", "mine"] as const;

export const useLegalEntities = () =>
  useQuery({
    queryKey: legalEntitiesKey,
    queryFn: () => api.get<LegalEntity[]>("/api/legal-entities"),
  });

type CreateInput = { name: string; taxId?: string | null; country?: string };

export const useCreateLegalEntity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInput) => api.post<LegalEntity>("/api/legal-entities", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: legalEntitiesKey }),
  });
};

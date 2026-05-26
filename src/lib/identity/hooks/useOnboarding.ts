"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { currentUserKey } from "./useCurrentUser";
import { myOrgsKey } from "@/lib/identity/organizations/hooks/useMyOrgs";

type Input = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  dni?: string | null;
  initialRole?: "buyer" | "promoter" | "organizer";
  entityName?: string | null;
  entityTaxId?: string | null;
  brandName?: string | null;
};

export const useOnboarding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) =>
      api.post<{ orgSlug: string | null }>("/api/auth/onboarding", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: currentUserKey });
      qc.invalidateQueries({ queryKey: myOrgsKey });
    },
  });
};

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Organization } from "@/server/identity/organizations/domain/Organization";

export type UpdateOrgInput = {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  description?: string | null;
  instagram?: string | null;
};

/** Actualiza la marca (organización). `slug` actual en la URL del PATCH. */
export const useUpdateOrganization = (currentSlug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateOrgInput) =>
      api.patch<Organization>(`/api/organizations/${currentSlug}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["identity", "my-orgs"] });
      qc.invalidateQueries({ queryKey: ["identity", "me"] });
    },
  });
};

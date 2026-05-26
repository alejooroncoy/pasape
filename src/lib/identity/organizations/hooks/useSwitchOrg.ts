"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";

export const useSwitchOrg = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      api.post<{ slug: string }>("/api/organizations/switch", { slug }),
    onSuccess: () => qc.invalidateQueries(),
  });
};

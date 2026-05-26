"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { orgInvitesKey } from "./useOrgInvites";

export const useRevokeInvite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/api/org/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgInvitesKey }),
  });
};

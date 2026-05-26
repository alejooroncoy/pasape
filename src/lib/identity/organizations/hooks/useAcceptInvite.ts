"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { myOrgsKey } from "./useMyOrgs";
import { currentUserKey } from "@/lib/identity/hooks/useCurrentUser";
import type { Organization } from "@/server/identity/organizations/domain/Organization";

export const useAcceptInvite = (token: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ org: Organization }>(`/api/invites/${token}/accept`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: myOrgsKey });
      qc.invalidateQueries({ queryKey: currentUserKey });
    },
  });
};

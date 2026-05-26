"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { OrgInviteRole, InviteScopeType } from "@/server/identity/organizations/domain/Invite";
import { orgInvitesKey } from "./useOrgInvites";

type Input =
  | {
      channel: "email";
      email: string;
      role: OrgInviteRole;
      scopeType?: InviteScopeType;
      scopeId?: string;
    }
  | {
      channel: "whatsapp";
      phone: string;
      role: OrgInviteRole;
      scopeType?: InviteScopeType;
      scopeId?: string;
    };

export type CreateInviteOutput = {
  id: string;
  expiresAt: string;
  sent: boolean;
  channel: "email" | "whatsapp";
  destination: string;
};

export const useCreateInvite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => api.post<CreateInviteOutput>("/api/org/invites", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgInvitesKey }),
  });
};

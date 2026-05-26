"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { ListInvitesResponse } from "@/server/identity/organizations/controllers/rest/InvitesController";

export const orgInvitesKey = ["identity", "orgs", "invites"] as const;

export const useOrgInvites = () =>
  useQuery({
    queryKey: orgInvitesKey,
    queryFn: () => api.get<ListInvitesResponse>("/api/org/invites"),
  });

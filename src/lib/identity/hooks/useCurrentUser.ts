"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { User } from "@/server/identity/domain/User";

export const currentUserKey = ["identity", "me"] as const;

export type MeResponse = { user: User; activeOrgSlug: string | null } | null;

export const useCurrentUser = () =>
  useQuery({
    queryKey: currentUserKey,
    queryFn: () => api.get<MeResponse>("/api/identity/me"),
  });

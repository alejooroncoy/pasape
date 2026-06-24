"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { User } from "@/server/identity/domain/User";

export const currentUserKey = ["identity", "me"] as const;

export type MeResponse = { user: User; activeOrgSlug: string | null } | null;

// gcTime largo (7 días): mantiene la sesión en cache para que el persister la
// conserve (offline + sin parpadeo). Coincide con el maxAge del persister.
const PERSIST_GC_TIME = 7 * 24 * 60 * 60 * 1000;

export const useCurrentUser = () =>
  useQuery({
    queryKey: currentUserKey,
    queryFn: () => api.get<MeResponse>("/api/identity/me"),
    gcTime: PERSIST_GC_TIME,
  });

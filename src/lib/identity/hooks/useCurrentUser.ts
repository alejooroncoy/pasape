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
    // staleTime 0 (no el default de 30s): el estado de sesión puede cambiar por
    // fuera de esta query (login/logout, otra pestaña, el dev-login) sin que
    // React Query se entere. Con staleTime > 0, un `null` persistido reciente
    // se sirve como "fresco" y NUNCA revalida al montar — MobileOnlyGuard y el
    // LoginGate deciden con ese null viejo y rebotan a un usuario ya logueado.
    staleTime: 0,
    // Offline: no esperar a que falle un fetch colgado; servir el snapshot ya
    // en memoria (persistido o fresco).
    networkMode: "offlineFirst",
    retry: (count) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return false;
      return count < 1;
    },
  });

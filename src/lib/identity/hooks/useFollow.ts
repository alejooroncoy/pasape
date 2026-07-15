"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { useFollowing, followingKey } from "./useFollowing";

/**
 * Estado y toggle de "seguir" una organización. Deriva `following` de la lista
 * que ya carga useFollowing (para invitados la query está deshabilitada → following=false).
 */
export const useFollow = (organizationId: string) => {
  const qc = useQueryClient();
  const following = useFollowing();
  const isFollowing = (following.data ?? []).some((o) => o.id === organizationId);

  const toggle = useMutation({
    mutationFn: () =>
      isFollowing
        ? api.del(`/api/identity/follows`, { organizationId })
        : api.post(`/api/identity/follows`, { organizationId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: followingKey }),
  });

  return {
    isFollowing,
    toggle: () => toggle.mutate(),
    isPending: toggle.isPending,
  };
};

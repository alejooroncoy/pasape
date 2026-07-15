"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { useDebouncedToggle } from "@/lib/_shared/hooks/useDebouncedToggle";
import { useFollowing, followingKey } from "./useFollowing";

/**
 * Estado y toggle de "seguir" una organización. Deriva `following` de la
 * lista que ya carga useFollowing (para invitados la query está
 * deshabilitada → following=false). El toggle es optimista + debounced
 * (useDebouncedToggle) — ver useSaveEvent para el motivo.
 */
export const useFollow = (organizationId: string) => {
  const qc = useQueryClient();
  const following = useFollowing();
  const serverFollowing = (following.data ?? []).some(
    (o) => o.id === organizationId,
  );

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? api.post(`/api/identity/follows`, { organizationId })
        : api.del(`/api/identity/follows`, { organizationId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: followingKey }),
  });

  const { value: isFollowing, toggle } = useDebouncedToggle(
    serverFollowing,
    (next) => mutation.mutateAsync(next),
  );

  return {
    isFollowing,
    toggle,
    isPending: mutation.isPending,
  };
};

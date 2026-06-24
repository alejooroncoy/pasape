"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { useSavedEvents, savedEventsKey } from "./useSavedEvents";

/**
 * Estado y toggle de "guardar" un evento. Deriva `isSaved` de la lista que ya
 * carga useSavedEvents (para invitados la query falla → isSaved=false).
 */
export const useSaveEvent = (eventId: string) => {
  const qc = useQueryClient();
  const saved = useSavedEvents();
  const isSaved = (saved.data ?? []).some((e) => e.id === eventId);

  const toggle = useMutation({
    mutationFn: () =>
      isSaved
        ? api.del(`/api/identity/saved-events`, { eventId })
        : api.post(`/api/identity/saved-events`, { eventId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedEventsKey }),
  });

  return {
    isSaved,
    toggle: () => toggle.mutate(),
    isPending: toggle.isPending,
  };
};

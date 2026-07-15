"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { useDebouncedToggle } from "@/lib/_shared/hooks/useDebouncedToggle";
import { useSavedEvents, savedEventsKey } from "./useSavedEvents";

/**
 * Estado y toggle de "guardar" un evento. Deriva `isSaved` de la lista que ya
 * carga useSavedEvents (para invitados la query falla → isSaved=false).
 * El toggle es optimista + debounced (useDebouncedToggle): varios taps
 * seguidos (doble-tap tipo "me gusta") solo persisten el estado final tras
 * una pausa, en vez de golpear la API en cada click.
 */
export const useSaveEvent = (eventId: string) => {
  const qc = useQueryClient();
  const saved = useSavedEvents();
  const serverSaved = (saved.data ?? []).some((e) => e.id === eventId);

  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      next
        ? api.post(`/api/identity/saved-events`, { eventId })
        : api.del(`/api/identity/saved-events`, { eventId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedEventsKey }),
  });

  const { value: isSaved, toggle } = useDebouncedToggle(serverSaved, (next) =>
    mutation.mutateAsync(next),
  );

  return {
    isSaved,
    toggle,
    isPending: mutation.isPending,
  };
};

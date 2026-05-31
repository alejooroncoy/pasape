"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Promo, PromoKind } from "@/server/events/domain/Event";

export type PromoDraft = {
  ticketTypeId: string;
  kind: PromoKind;
  endsAt?: string | null;
};

/** Reemplaza todas las promos del evento (PUT). */
export const useSetPromos = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promos: PromoDraft[]) =>
      api.put<Promo[]>(`/api/events/${slug}/promos`, { promos }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", "detail", slug] });
    },
  });
};

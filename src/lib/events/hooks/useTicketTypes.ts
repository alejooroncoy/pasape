"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { TicketType, TicketTypeKind } from "@/server/events/domain/Event";

type PresalePayload = {
  presalePriceCents?: number | null;
  presaleQty?: number | null;
  presaleEndsAt?: string | null;
};

/** Liberar gratis: toggle + fin opcional (null = mientras esté activa). */
type FreePayload = {
  isFree?: boolean;
  freeUntilAt?: string | null;
};

export type CreateTicketTypePayload = {
  name: string;
  kind: TicketTypeKind;
  priceCents: number;
  capacity: number;
  boxLabel?: string | null;
  unitNoun?: string | null;
  saleEndsAt?: string | null;
  description?: string | null;
  presaleTiers?: Array<{ priceCents: number; endsAt: string }>;
} & PresalePayload & FreePayload;

export type UpdateTicketTypePayload = {
  name?: string;
  priceCents?: number;
  capacity?: number;
  boxLabel?: string | null;
  unitNoun?: string | null;
  saleEndsAt?: string | null;
  description?: string | null;
  presaleTiers?: Array<{ priceCents: number; endsAt: string }>;
} & PresalePayload & FreePayload;

const invalidate = (qc: ReturnType<typeof useQueryClient>, slug: string) => {
  qc.invalidateQueries({ queryKey: ["events", "detail", slug] });
  qc.invalidateQueries({ queryKey: ["events", "mine"] });
  qc.invalidateQueries({ queryKey: ["events", "stats", slug] });
};

export const useCreateTicketType = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketTypePayload) =>
      api.post<TicketType>(`/api/events/${slug}/ticket-types`, input),
    onSuccess: () => invalidate(qc, slug),
  });
};

export const useUpdateTicketType = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTicketTypePayload }) =>
      api.patch<TicketType>(`/api/events/${slug}/ticket-types/${id}`, input),
    onSuccess: () => invalidate(qc, slug),
  });
};

export const useDeleteTicketType = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.del<{ id: string }>(`/api/events/${slug}/ticket-types/${id}`),
    onSuccess: () => invalidate(qc, slug),
  });
};

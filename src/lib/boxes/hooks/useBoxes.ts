"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Box } from "@/server/boxes/domain/Box";

// Why: BOX share/join screens display a live "X/Y" counter; polling every
// 8s keeps it fresh without realtime infra and matches typical join cadence.
const LIVE_REFETCH_MS = 8000;

export const useBoxByToken = (token: string) =>
  useQuery({
    queryKey: ["boxes", "token", token],
    queryFn: () => api.get<Box>(`/api/boxes/${token}`),
    enabled: !!token,
    refetchInterval: LIVE_REFETCH_MS,
  });

export const useBoxForTicket = (ticketId: string, linkToken?: string | null) =>
  useQuery({
    queryKey: ["boxes", "ticket", ticketId, linkToken ?? ""],
    queryFn: () => {
      const qs = linkToken ? `?k=${encodeURIComponent(linkToken)}` : "";
      return api.get<Box | null>(`/api/boxes/ticket/${ticketId}${qs}`);
    },
    enabled: !!ticketId,
    refetchInterval: LIVE_REFETCH_MS,
  });

export const useCreateBox = (linkToken?: string | null) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; capacity?: number }) => {
      const qs = linkToken ? `?k=${encodeURIComponent(linkToken)}` : "";
      return api.post<Box>(`/api/boxes${qs}`, input);
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["boxes", "ticket", vars.ticketId] }),
  });
};

export const useJoinBox = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      token: string;
      holderName: string;
      holderDni?: string | null;
      holderPhone?: string | null;
    }) =>
      api.post<Box & { joinedTicket: { id: string; k: string } | null }>(
        "/api/boxes/join",
        input,
      ),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["boxes", "token", vars.token] }),
  });
};

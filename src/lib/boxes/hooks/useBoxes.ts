"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";
import { api } from "@/lib/_shared/api-client";
import type { Box } from "@/server/boxes/domain/Box";

export const useBoxByToken = (token: string) =>
  useQuery({
    queryKey: ["boxes", "token", token],
    queryFn: () => api.get<Box>(`/api/boxes/${token}`),
    enabled: !!token,
  });

export const useBoxForTicket = (ticketId: string, linkToken?: string | null) =>
  useQuery({
    queryKey: ["boxes", "ticket", ticketId, linkToken ?? ""],
    queryFn: () => {
      const qs = linkToken ? `?k=${encodeURIComponent(linkToken)}` : "";
      return api.get<Box | null>(`/api/boxes/ticket/${ticketId}${qs}`);
    },
    enabled: !!ticketId,
  });

// Realtime del contador "X/Y" del box vía Broadcast desde la DB (trigger
// box_members_broadcast → topic `box:<inviteToken>`). Reemplaza el polling de 8s:
// cuando alguien se une o sale, la DB empuja un ping y refrescamos. Como en estas
// pantallas hay un solo box activo, invalidamos el prefijo ["boxes"] (barato).
// Pasa el inviteToken: en /box/[token] es el token de la ruta; en las pantallas
// de ticket sale de box.data?.inviteToken una vez cargado.
export function useRealtimeBox(inviteToken: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!inviteToken) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`box:${inviteToken}`)
      .on("broadcast", { event: "box_changed" }, () => {
        void qc.invalidateQueries({ queryKey: ["boxes"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [inviteToken, qc]);
}

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

// El host agrega un acompañante sin celular (su QR lo lleva el host).
export const useAddBoxCompanion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; holderName: string; holderDni?: string | null }) =>
      api.post<Box>("/api/boxes/add-companion", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boxes"] }),
  });
};

// El host quita a un integrante del box (anula su QR, libera el asiento).
export const useRemoveBoxMember = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; memberProfileId: string }) =>
      api.post<Box>("/api/boxes/remove-member", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["boxes"] }),
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

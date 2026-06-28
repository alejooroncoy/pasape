"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Order, Ticket, TransferOutcome, WalletTicket } from "@/server/tickets/domain/Ticket";

export const myTicketsKey = ["tickets", "mine"] as const;

// gcTime largo (7 días): mantiene la wallet en cache para que el persister la
// conserve → disponible offline y sin parpadeo. Coincide con el maxAge del
// persister (ver query-client.tsx).
const PERSIST_GC_TIME = 7 * 24 * 60 * 60 * 1000;

export const useMyTickets = () =>
  useQuery({
    queryKey: myTicketsKey,
    queryFn: () => api.get<WalletTicket[]>("/api/tickets/my"),
    gcTime: PERSIST_GC_TIME,
  });

export const useTicket = (id: string, linkToken?: string | null) =>
  useQuery({
    queryKey: ["tickets", "detail", id, linkToken ?? ""],
    queryFn: () => {
      const qs = linkToken ? `?k=${encodeURIComponent(linkToken)}` : "";
      return api.get<WalletTicket>(`/api/tickets/${id}${qs}`);
    },
    enabled: !!id,
    gcTime: PERSIST_GC_TIME,
    // Mientras la entrada está ACTIVA y el holder la tiene abierta, sondeamos cada
    // 4s: apenas el portero la valida (que empuja el "usado" al server al instante),
    // la vista pasa a "Ya usada" casi en tiempo real. Al volverse usada/anulada el
    // polling se detiene solo (no hay nada más que actualizar). No corre en
    // background: solo con la pestaña enfocada (justo cuando se muestra el QR).
    refetchInterval: (query) =>
      query.state.data?.status === "active" ? 4000 : false,
  });

export type GuestBuyer = {
  email?: string | null;
  phone?: string | null;
  fullName: string;
  dni: string;
};

export type BuyInput = {
  eventId: string;
  items: Array<{ ticketTypeId: string; qty: number; holderName?: string | null }>;
  promoCode?: string | null;
  guest?: GuestBuyer;
  /** Datos del comprador logueado (mismos campos que guest, sin crear auth user).
      Se persisten en su perfil/kyc para autorrellenar la próxima compra. */
  buyer?: GuestBuyer;
};

export type BuyResult = {
  order: Order;
  tickets: Ticket[];
  preference: { id: string; initPoint: string };
};

export const useBuyTickets = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BuyInput) =>
      api.post<BuyResult>("/api/tickets/buy", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: myTicketsKey }),
  });
};

// Invalida todo el prefijo ["tickets"] (wallet + detalle) — el detalle usa una
// key distinta a myTicketsKey, así que el estado pendiente debe refrescar ahí.
const ticketsRoot = ["tickets"] as const;

export const useTransferTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; toPhone: string }) =>
      api.post<TransferOutcome>("/api/tickets/transfer", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketsRoot }),
  });
};

export const useCancelTransfer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string }) =>
      api.post<{ ok: true }>("/api/tickets/cancel-transfer", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketsRoot }),
  });
};

// Reparto post-compra: asigna nombre/DNI del titular de una entrada propia.
export const useSetHolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; holderName: string | null; dni?: string | null }) =>
      api.post<Ticket>("/api/tickets/set-holder", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketsRoot }),
  });
};

export type CarouselScope = { ids: string[]; currentIndex: number; eventTicketCount: number };

export const useCarouselScope = (ticketId: string) =>
  useQuery({
    queryKey: ["tickets", "carousel", ticketId] as const,
    queryFn: () => api.get<CarouselScope>(`/api/tickets/${ticketId}/carousel-scope`),
    enabled: !!ticketId,
  });

export const useClaimTransfer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; fullName?: string | null; dni?: string | null }) =>
      api.post<{ ticketId: string; eventSlug: string }>("/api/tickets/claim", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketsRoot }),
  });
};

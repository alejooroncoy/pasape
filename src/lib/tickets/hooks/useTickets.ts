"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Order, Ticket, WalletTicket } from "@/server/tickets/domain/Ticket";

export const myTicketsKey = ["tickets", "mine"] as const;

export const useMyTickets = () =>
  useQuery({ queryKey: myTicketsKey, queryFn: () => api.get<WalletTicket[]>("/api/tickets/my") });

export const useTicket = (id: string, linkToken?: string | null) =>
  useQuery({
    queryKey: ["tickets", "detail", id, linkToken ?? ""],
    queryFn: () => {
      const qs = linkToken ? `?k=${encodeURIComponent(linkToken)}` : "";
      return api.get<WalletTicket>(`/api/tickets/${id}${qs}`);
    },
    enabled: !!id,
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

export const useTransferTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; toIdentifier: string }) =>
      api.post<Ticket>("/api/tickets/transfer", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: myTicketsKey }),
  });
};

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { useOnline } from "@/lib/_shared/useOnline";
import { useSessionReady } from "./useSessionReady";
import type { Notification } from "@/server/identity/application/ListNotifications";

export const notificationsKey = ["identity", "notifications"] as const;

export const useNotifications = () =>
  useQuery({
    queryKey: notificationsKey,
    queryFn: () => api.get<Notification[]>("/api/identity/notifications"),
  });

export const unreadTicketNotificationsKey = ["identity", "notifications", "unread-tickets"] as const;

// networkMode "online": nunca resuelve desde el cache persistido (IndexedDB)
// mientras estamos offline — el dot solo refleja un conteo recién confirmado
// por el servidor, nunca uno potencialmente viejo.
const useUnreadTicketNotifications = () => {
  const { sessionReady, loggedIn } = useSessionReady();
  return useQuery({
    queryKey: unreadTicketNotificationsKey,
    queryFn: () => api.get<{ count: number }>("/api/identity/notifications/unread-count"),
    enabled: sessionReady && loggedIn,
    networkMode: "online",
    staleTime: 60_000,
  });
};

// Dot del tab "Mis entradas" en el bottom nav. Se apaga offline a propósito:
// un dot mostrado desde cache podría estar desactualizado (ej. ya lo viste en
// otro device, o el ticket ya no es nuevo) y el usuario no tiene forma de
// refrescarlo sin red — mejor no mostrar nada que mostrar algo que puede mentir.
export const useHasNewTickets = (): boolean => {
  const online = useOnline();
  const { data } = useUnreadTicketNotifications();
  return online && (data?.count ?? 0) > 0;
};

export const useMarkTicketNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ marked: true }>("/api/identity/notifications/mark-read"),
    onSuccess: () => {
      qc.setQueryData(unreadTicketNotificationsKey, { count: 0 });
      qc.invalidateQueries({ queryKey: notificationsKey });
    },
  });
};

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { Notification } from "@/server/identity/application/ListNotifications";

export const notificationsKey = ["identity", "notifications"] as const;

export const useNotifications = () =>
  useQuery({
    queryKey: notificationsKey,
    queryFn: () => api.get<Notification[]>("/api/identity/notifications"),
  });

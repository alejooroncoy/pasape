"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { getDeviceId } from "@/lib/scanning/deviceId";

export type SessionStatus = {
  active: boolean;
  via: "membership" | "session" | null;
  zoneId: string | null;
};

export const useScannerSession = (eventSlug: string) => {
  const device = typeof window !== "undefined" ? getDeviceId() : "";
  return useQuery({
    queryKey: ["scanner-session", eventSlug, device],
    queryFn: () =>
      api.get<SessionStatus>(
        `/api/scanning/session?event=${encodeURIComponent(eventSlug)}&device=${encodeURIComponent(device)}`,
      ),
    enabled: !!eventSlug,
    retry: false,
  });
};

export const useJoinByCode = (eventSlug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      code: string;
      fullName?: string | null;
      dniLast2?: string | null;
    }) =>
      api.post<{ eventSlug: string; zoneId: string | null; expiresAt: string }>(
        "/api/scanning/join",
        { ...input, deviceId: getDeviceId() },
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["scanner-session", eventSlug] }),
  });
};

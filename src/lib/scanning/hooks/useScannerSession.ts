"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import { getDeviceId, deviceHeaders, setDoorToken, getDoorToken } from "@/lib/scanning/deviceId";
import type { Zone } from "@/server/events/domain/Zone";

// Puertas del evento que el portero puede elegir (acceso por token de sesión).
export const useDoors = (eventSlug: string) => {
  const device = typeof window !== "undefined" ? getDeviceId() : "";
  return useQuery({
    queryKey: ["scanner-doors", eventSlug, device],
    queryFn: () =>
      api.get<Zone[]>(
        `/api/scanning/doors?event=${encodeURIComponent(eventSlug)}&device=${encodeURIComponent(device)}`,
        { headers: deviceHeaders() },
      ),
    enabled: !!eventSlug,
    retry: false,
  });
};

// El portero cambia su puerta activa. zoneId null = puerta principal.
export const useSetZone = (eventSlug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string | null) =>
      api.post<{ zoneId: string | null }>(
        "/api/scanning/zone",
        { eventSlug, zoneId, deviceId: getDeviceId() },
        { headers: deviceHeaders() },
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["scanner-session", eventSlug] }),
  });
};

export type SessionStatus = {
  active: boolean;
  via: "membership" | "session" | null;
  zoneId: string | null;
};

export const useScannerSession = (eventSlug: string) => {
  const device = typeof window !== "undefined" ? getDeviceId() : "";
  // Offline-first: si el portero ya canjeó su código (token en localStorage),
  // asumimos la sesión ACTIVA de entrada para que pueda escanear aunque esté sin
  // red en la puerta. `initialDataUpdatedAt: 0` la marca como obsoleta → cuando
  // haya red, el refetch trae el estado real del server (y si fue revocada, lo
  // corrige). Sin token (organizador por cookie) no hay initialData = igual que
  // antes. Sin este optimismo, un corte de señal expulsaría al portero al
  // onboarding en plena puerta.
  const hasToken = typeof window !== "undefined" && !!getDoorToken();
  return useQuery({
    queryKey: ["scanner-session", eventSlug, device],
    queryFn: () =>
      api.get<SessionStatus>(
        `/api/scanning/session?event=${encodeURIComponent(eventSlug)}&device=${encodeURIComponent(device)}`,
        { headers: deviceHeaders() },
      ),
    enabled: !!eventSlug,
    retry: false,
    initialData: hasToken
      ? ({ active: true, via: "session", zoneId: null } satisfies SessionStatus)
      : undefined,
    initialDataUpdatedAt: 0,
  });
};

// Paso 1 del onboarding: valida el código por detrás (sin crear sesión) y
// devuelve a qué evento pertenece. Si el código es inválido, el portero se
// entera ANTES de identificarse.
export const useResolveCode = () => {
  return useMutation({
    mutationFn: (code: string) =>
      api.get<{ eventSlug: string; eventTitle: string }>(
        `/api/scanning/resolve-code?code=${encodeURIComponent(code)}`,
      ),
  });
};

// El código resuelve el evento por sí solo (lookup global en el server). Al
// canjear, el backend devuelve el token de portero → se guarda para mandarlo en
// cada request siguiente (auth por código, sin cuenta).
export const useJoinByCode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      code: string;
      fullName?: string | null;
      dni?: string | null;
    }) =>
      api.post<{
        token: string;
        eventSlug: string;
        zoneId: string | null;
        expiresAt: string;
      }>("/api/scanning/join", { ...input, deviceId: getDeviceId() }),
    onSuccess: (res) => {
      setDoorToken(res.token);
      qc.invalidateQueries({ queryKey: ["scanner-session", res.eventSlug] });
    },
  });
};

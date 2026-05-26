"use client";

import { useEffect, useState } from "react";

type State = {
  payload: string | null;
  windowIdx: number | null;
  expiresAt: number | null;
  secondsLeft: number;
  loading: boolean;
  error: string | null;
};

/**
 * Hook genérico para QR rotante. Le pasás el endpoint que devuelve
 * `{ data: { payload, windowIdx, expiresAt, ttlSeconds } }` y mantiene el
 * código actualizado refetcheando 1.5s antes de que expire. Si url es vacío,
 * el hook queda idle (útil para no firear cuando el ticket no está activo).
 */
export const useRotatingQr = (url: string | null): State => {
  const [state, setState] = useState<State>({
    payload: null,
    windowIdx: null,
    expiresAt: null,
    secondsLeft: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!url) {
      setState({
        payload: null,
        windowIdx: null,
        expiresAt: null,
        secondsLeft: 0,
        loading: false,
        error: null,
      });
      return;
    }
    let cancelled = false;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchNow = async () => {
      try {
        const res = await fetch(url);
        if (cancelled) return;
        const json = (await res.json().catch(() => ({}))) as {
          data?: { payload: string; windowIdx: number; expiresAt: number };
          error?: string;
        };
        if (!res.ok || !json.data) {
          setState((s) => ({ ...s, loading: false, error: json.error ?? `http_${res.status}` }));
          return;
        }
        setState({
          payload: json.data.payload,
          windowIdx: json.data.windowIdx,
          expiresAt: json.data.expiresAt,
          secondsLeft: Math.max(0, Math.round((json.data.expiresAt - Date.now()) / 1000)),
          loading: false,
          error: null,
        });
        const msUntilRefetch = Math.max(500, json.data.expiresAt - Date.now() - 1500);
        refetchTimer = setTimeout(() => void fetchNow(), msUntilRefetch);
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
        refetchTimer = setTimeout(() => void fetchNow(), 5000);
      }
    };

    void fetchNow();

    const tickInterval = setInterval(() => {
      setState((s) => {
        if (!s.expiresAt) return s;
        return { ...s, secondsLeft: Math.max(0, Math.round((s.expiresAt - Date.now()) / 1000)) };
      });
    }, 1000);

    return () => {
      cancelled = true;
      if (refetchTimer) clearTimeout(refetchTimer);
      clearInterval(tickInterval);
    };
  }, [url]);

  return state;
};

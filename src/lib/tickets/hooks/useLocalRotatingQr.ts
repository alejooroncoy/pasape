"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/_shared/api-client";
import {
  buildCompactQrPayload,
  signWindow,
  WINDOW_SECONDS,
} from "@/lib/tickets/signedQr";
import {
  getCachedCert,
  getOrCreateTicketKey,
  saveCert,
} from "@/lib/tickets/ticketKeyStore";

type CertResp = {
  ticketId: string;
  cert: string;
  windowSeconds: number;
};

type State = {
  payload: string | null;
  windowIdx: number | null;
  secondsLeft: number;
  loading: boolean;
  error: string | null;
};

const CERT_REFRESH_MS = 24 * 60 * 60 * 1000; // refrescar cert si tiene >24h y hay red

/**
 * Precalienta el cert (y la clave no-extraíble) de una entrada SIN renderizar su
 * QR. Se usa para las entradas vecinas del carrusel: al precargar online, el
 * swipe muestra el QR al instante y 100% offline. Best-effort: si ya hay cert
 * cacheado o estamos offline, no hace nada y nunca lanza.
 */
export async function prewarmTicketCert(
  ticketId: string,
  k?: string | null,
): Promise<void> {
  try {
    const cached = await getCachedCert(ticketId);
    if (cached) return; // ya disponible offline
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const { pubJwk } = await getOrCreateTicketKey(ticketId);
    const path = k
      ? `/api/t/${ticketId}/secret?k=${encodeURIComponent(k)}`
      : `/api/t/${ticketId}/secret`;
    const resp = await api.post<CertResp>(path, { publicJwk: pubJwk });
    await saveCert(ticketId, resp.cert);
  } catch {
    // best-effort: el cert se obtendrá al abrir la entrada si hace falta
  }
}

/**
 * Genera el QR rotativo firmado (ECDSA P-256) en el device, 100% offline tras la
 * primera carga online. La privada del ticket es no-extraíble (IndexedDB); el
 * server solo entregó un cert que liga la pública al evento. Cada window (10s)
 * se firma localmente: payload = cert ~ windowIdx ~ sign(priv, "ticketId|window").
 *
 * Reemplaza el HMAC simétrico anterior: la clave ya no viaja al cliente.
 */
export const useLocalRotatingQr = (
  ticketId: string | null,
  k?: string | null,
): State => {
  const [state, setState] = useState<State>({
    payload: null,
    windowIdx: null,
    secondsLeft: 0,
    loading: true,
    error: null,
  });
  const privRef = useRef<CryptoKey | null>(null);
  const certRef = useRef<string | null>(null);
  const windowIdxRef = useRef<number | null>(null);
  const payloadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setState({
        payload: null,
        windowIdx: null,
        secondsLeft: 0,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    const windowSeconds = WINDOW_SECONDS;

    const tick = async () => {
      const priv = privRef.current;
      const cert = certRef.current;
      if (!priv || !cert) return;
      const now = Date.now();
      const windowIdx = Math.floor(now / 1000 / windowSeconds);
      const secondsLeft =
        windowSeconds - Math.floor((now / 1000) % windowSeconds);

      if (windowIdx !== windowIdxRef.current) {
        // Nueva ventana: firmar una sola vez y cachear.
        // ECDSA P-256 es no-determinístico — nunca llamar signWindow más de una vez
        // por ventana o el QR cambiaría en cada tick aunque los datos sean los mismos.
        const sig = await signWindow(priv, ticketId, windowIdx);
        const payload = buildCompactQrPayload(ticketId, windowIdx, sig);
        windowIdxRef.current = windowIdx;
        payloadRef.current = payload;
        if (cancelled) return;
        setState({ payload, windowIdx, secondsLeft, loading: false, error: null });
      } else {
        // Misma ventana: solo actualizar el countdown.
        if (cancelled) return;
        setState((prev) => ({ ...prev, secondsLeft }));
      }
    };

    const fetchCert = async (pubJwk: JsonWebKey): Promise<string> => {
      const path = k
        ? `/api/t/${ticketId}/secret?k=${encodeURIComponent(k)}`
        : `/api/t/${ticketId}/secret`;
      const resp = await api.post<CertResp>(path, { publicJwk: pubJwk });
      await saveCert(ticketId, resp.cert);
      return resp.cert;
    };

    const init = async () => {
      try {
        const { priv, pubJwk } = await getOrCreateTicketKey(ticketId);
        if (cancelled) return;
        privRef.current = priv;

        const cached = await getCachedCert(ticketId);
        const online =
          typeof navigator === "undefined" ? true : navigator.onLine;
        const stale = !cached || Date.now() - cached.fetchedAt > CERT_REFRESH_MS;

        if (cached) certRef.current = cached.cert;

        // Sin cert cacheado: necesitamos red la primera vez.
        if (!cached) {
          if (!online) {
            if (cancelled) return;
            setState({
              payload: null,
              windowIdx: null,
              secondsLeft: 0,
              loading: false,
              error: "offline_no_cert",
            });
            return;
          }
          certRef.current = await fetchCert(pubJwk);
        } else if (stale && online) {
          // Refresco oportunista en background; el cert viejo sigue sirviendo.
          fetchCert(pubJwk)
            .then((c) => {
              certRef.current = c;
            })
            .catch(() => {});
        }

        if (cancelled) return;
        await tick();
      } catch (e) {
        if (cancelled) return;
        setState({
          payload: null,
          windowIdx: null,
          secondsLeft: 0,
          loading: false,
          error: (e as Error).message ?? "cert_load_failed",
        });
      }
    };

    void init();
    // Refresh cada segundo para el countdown ring; el code real solo cambia al
    // cruzar el límite de window.
    interval = setInterval(() => void tick(), 1000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [ticketId, k]);

  return state;
};

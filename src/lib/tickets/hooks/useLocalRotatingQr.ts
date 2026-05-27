"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/_shared/api-client";

type SecretResp = {
  ticketId: string;
  secretB64: string;
  validUntil: number;
  windowSeconds: number;
  codeLength: number;
};

type State = {
  payload: string | null;
  windowIdx: number | null;
  secondsLeft: number;
  loading: boolean;
  error: string | null;
};

const base64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const computeCode = async (
  key: CryptoKey,
  ticketId: string,
  windowIdx: number,
  codeLength: number,
): Promise<string> => {
  const data = new TextEncoder().encode(`${ticketId}|${windowIdx}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return bytesToBase64Url(new Uint8Array(sig)).slice(0, codeLength);
};

/**
 * Hook que reemplaza el polling al server por TOTP local. Fetch del secret
 * UNA vez (TTL 30min), después computa el HMAC en el browser cada window.
 * Si el secret expira o el ticket pasa a inactive, refetch automático.
 */
export const useLocalRotatingQr = (secretUrl: string | null): State => {
  const [state, setState] = useState<State>({
    payload: null,
    windowIdx: null,
    secondsLeft: 0,
    loading: true,
    error: null,
  });
  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const metaRef = useRef<SecretResp | null>(null);

  useEffect(() => {
    if (!secretUrl) {
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

    const tick = async () => {
      const meta = metaRef.current;
      const key = cryptoKeyRef.current;
      if (!meta || !key) return;
      const now = Date.now();
      // Si el secret expiró, refetch.
      if (now >= meta.validUntil) {
        await loadSecret();
        return;
      }
      const windowIdx = Math.floor(now / 1000 / meta.windowSeconds);
      const code = await computeCode(key, meta.ticketId, windowIdx, meta.codeLength);
      const payload = `${meta.ticketId}.${windowIdx}.${code}`;
      const secondsLeft =
        meta.windowSeconds - Math.floor((now / 1000) % meta.windowSeconds);
      if (cancelled) return;
      setState({
        payload,
        windowIdx,
        secondsLeft,
        loading: false,
        error: null,
      });
    };

    const loadSecret = async () => {
      try {
        const meta = await api.get<SecretResp>(secretUrl);
        const keyBytes = base64ToBytes(meta.secretB64);
        const key = await crypto.subtle.importKey(
          "raw",
          keyBytes as BufferSource,
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        if (cancelled) return;
        metaRef.current = meta;
        cryptoKeyRef.current = key;
        await tick();
      } catch (e) {
        if (cancelled) return;
        setState({
          payload: null,
          windowIdx: null,
          secondsLeft: 0,
          loading: false,
          error: (e as Error).message ?? "secret_load_failed",
        });
      }
    };

    void loadSecret();
    // Refresh visible cada segundo para el countdown ring; el code real
    // solo cambia cuando crosses window boundary.
    interval = setInterval(() => void tick(), 1000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [secretUrl]);

  return state;
};

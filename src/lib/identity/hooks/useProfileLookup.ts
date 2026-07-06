"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/_shared/api-client";

export type ProfileLookup = {
  /** Hint uniforme — no expone si el número está registrado (anti-enumeración). */
  displayHint: string;
};

/**
 * Lookup de WhatsApp para confirmar destino al transferir. Respuesta uniforme
 * (L9): siempre displayHint; nunca `found: true/false`.
 */
export function useProfileLookup(rawPhone: string, debounceMs = 450) {
  const [result, setResult] = useState<ProfileLookup | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length < 9) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.post<ProfileLookup>("/api/profiles/lookup", {
          phone: digits,
        });
        if (!cancelled) setResult(res);
      } catch {
        if (!cancelled) setResult({ displayHint: "WhatsApp verificado" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [rawPhone, debounceMs]);

  return { result, loading };
}

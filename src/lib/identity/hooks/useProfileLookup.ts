"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/_shared/api-client";

export type ProfileLookup =
  | { found: true; displayName: string }
  | { found: false };

/**
 * Hook estilo Yape: cuando el comprador escribe el WhatsApp del destinatario,
 * después de un debounce buscamos el perfil y mostramos el nombre corto para
 * confirmar visualmente. Si no hay match, dejamos found: false (no error).
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
        if (!cancelled) setResult({ found: false });
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

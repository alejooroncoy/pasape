"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/_shared/api-client";

/**
 * Hook para autocompletar el nombre desde DNI vía Decolecta/RENIEC.
 *
 * Uso: `const { lookup, pending } = useDniLookup()`.
 * El caller debe aplicar su propio debounce (ej. 600ms) antes de llamar
 * a `lookup(dni)`. Devuelve `null` si el lookup falla por cualquier motivo —
 * el form debe seguir permitiendo edición manual.
 */
export type DniLookupResult = { fullName: string };

export const useDniLookup = () => {
  const [pending, setPending] = useState(false);
  // Tracking de la última llamada para descartar respuestas obsoletas
  // si el usuario sigue tipeando.
  const reqIdRef = useRef(0);

  const lookup = useCallback(
    async (dni: string): Promise<DniLookupResult | null> => {
      if (!/^\d{8}$/.test(dni)) return null;
      const id = ++reqIdRef.current;
      setPending(true);
      try {
        const data = await api.get<DniLookupResult>(
          `/api/identity/dni-lookup?dni=${encodeURIComponent(dni)}`,
        );
        if (id !== reqIdRef.current) return null;
        return data;
      } catch {
        return null;
      } finally {
        if (id === reqIdRef.current) setPending(false);
      }
    },
    [],
  );

  return { lookup, pending };
};

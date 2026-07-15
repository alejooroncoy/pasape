"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 500;

/**
 * Toggle optimista con debounce. La UI se actualiza al instante en cada
 * click, pero la llamada real (`mutateAsync`) solo se dispara tras una
 * pausa sin clicks — evita golpear la API en cada tap de un doble-tap tipo
 * "me gusta". Si el estado final coincide con el del servidor (ej. un
 * tap-tap que se cancela), no llama a la API. Si `mutateAsync` falla, la UI
 * vuelve al valor real del servidor.
 */
export const useDebouncedToggle = (
  serverValue: boolean,
  mutateAsync: (next: boolean) => Promise<unknown>,
  debounceMs = DEFAULT_DEBOUNCE_MS,
) => {
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const value = optimistic ?? serverValue;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs para leer el valor más reciente dentro del setTimeout, que se
  // programó con el closure de un render anterior.
  const serverValueRef = useRef(serverValue);
  serverValueRef.current = serverValue;
  const mutateRef = useRef(mutateAsync);
  mutateRef.current = mutateAsync;

  // Una vez que el servidor confirma el valor optimista (mutación exitosa +
  // refetch, o cualquier otro cambio externo), se limpia el override.
  useEffect(() => {
    if (optimistic !== null && optimistic === serverValue) setOptimistic(null);
  }, [optimistic, serverValue]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const toggle = () => {
    const next = !value;
    setOptimistic(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (next === serverValueRef.current) return;
      mutateRef.current(next).catch(() => setOptimistic(null));
    }, debounceMs);
  };

  return { value, toggle };
};

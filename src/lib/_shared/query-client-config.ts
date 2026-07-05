import { QueryClient } from "@tanstack/react-query";

// gcTime largo (7 días) para las queries que el persister de IndexedDB debe
// conservar offline (wallet, sesión). Debe coincidir con el maxAge del
// persister (ver query-client.tsx) — una sola constante evita que ambos
// valores diverjan.
export const PERSIST_GC_TIME_MS = 7 * 24 * 60 * 60 * 1000;

// Config compartida entre el QueryClient del cliente (QueryProvider) y el del
// server usado para prefetch + dehydrate. Mantenerla en un solo lugar evita que
// el cache hidratado y el del cliente difieran en staleTime/gcTime.
export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // gcTime explícito: las queries inactivas se liberan a los 5 min en vez
        // de retener memoria en sesiones largas (sobre todo en Capacitor).
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

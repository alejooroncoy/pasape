import { QueryClient } from "@tanstack/react-query";

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

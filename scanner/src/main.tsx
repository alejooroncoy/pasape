import { installApiBase } from "./apiBase";
// Fija __API_BASE__ ANTES de importar cualquier código que use el api-client.
installApiBase();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      // Offline-first: si no hay red, usar lo que haya en cache sin reintentar
      // en bucle. El syncWorker y el cache local cubren la validación sin server.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

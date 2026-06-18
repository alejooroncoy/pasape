"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, type ReactNode } from "react";
import { makeQueryClient } from "./query-client-config";
import { createIdbPersister } from "./query-persister";

// Persistimos a IndexedDB las queries privadas de la wallet (usuario + entradas
// + detalle) para que estén disponibles offline y rendericen sin parpadeo en
// recargas. El resto de queries (eventos públicos, etc.) NO se persisten.
const PERSISTED_ROOTS = new Set(["tickets", "identity"]);
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 días
// Subir el buster invalida toda la cache persistida (p. ej. si cambia el shape).
const BUSTER = "pasape-rq-v1";

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  const [client] = useState(makeQueryClient);
  const [persister] = useState(createIdbPersister);

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: MAX_AGE,
        buster: BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" &&
            PERSISTED_ROOTS.has(query.queryKey?.[0] as string),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};

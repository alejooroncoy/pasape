"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState, type ReactNode } from "react";
import { makeQueryClient, PERSIST_GC_TIME_MS } from "./query-client-config";
import { createIdbPersister } from "./query-persister";

// Persistimos a IndexedDB las queries privadas de la wallet (usuario + entradas
// + detalle) para que estén disponibles offline y rendericen sin parpadeo en
// recargas. El resto de queries (eventos públicos, etc.) NO se persisten.
const PERSISTED_ROOTS = new Set(["tickets", "identity"]);
const MAX_AGE = PERSIST_GC_TIME_MS;
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

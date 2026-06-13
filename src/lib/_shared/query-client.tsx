"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { makeQueryClient } from "./query-client-config";

export const QueryProvider = ({ children }: { children: ReactNode }) => {
  // Una instancia estable por montaje del cliente. La config vive en
  // query-client-config para compartirla con el prefetch server-side.
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

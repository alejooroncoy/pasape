"use client";

import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { prewarmTicketCert } from "@/lib/tickets/hooks/useLocalRotatingQr";
import {
  carouselScopeKey,
  fetchCarouselScope,
  fetchTicketDetail,
  ticketDetailKey,
} from "@/lib/tickets/hooks/useTickets";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";

// Concurrencia al precargar: no saturar el server ni el device del usuario.
const PREFETCH_CONCURRENCY = 4;

const prefetchedSigs = new Set<string>();

export const resetPrefetchWallet = () => prefetchedSigs.clear();

const preloadImage = (url: string): Promise<void> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });

async function runPool<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        await fn(item);
      }
    }),
  );
}

/**
 * Precarga offline de toda la wallet: detalle, carrusel, cert QR e imágenes.
 * Se dispara al abrir /tickets online — así cualquier entrada abre al instante
 * y el QR funciona sin haber entrado antes a cada una (estilo Quentro).
 */
export async function prefetchWalletTickets(
  qc: QueryClient,
  tickets: WalletTicket[],
): Promise<void> {
  if (!tickets.length) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const sig = tickets
    .map((t) => t.id)
    .sort()
    .join(",");
  if (prefetchedSigs.has(sig)) return;
  prefetchedSigs.add(sig);

  // 1. Siembra inmediata desde el listado: offline-ready aunque el enrich falle.
  for (const ticket of tickets) {
    qc.setQueryData(ticketDetailKey(ticket.id), (prev: WalletTicket | undefined) => prev ?? ticket);
  }

  // 2. Enriquece en background (detalle fresco, carrusel, cert, covers).
  await runPool(
    tickets,
    async (ticket) => {
      await qc
        .prefetchQuery({
          queryKey: ticketDetailKey(ticket.id),
          queryFn: () => fetchTicketDetail(ticket.id),
          staleTime: 60_000,
        })
        .catch(() => {});

      await qc
        .prefetchQuery({
          queryKey: carouselScopeKey(ticket.id),
          queryFn: () => fetchCarouselScope(ticket.id),
          staleTime: 60_000,
        })
        .catch(() => {});

      if (ticket.status === "active") {
        await prewarmTicketCert(ticket.id);
      }

      const cover = ticket.event.coverUrl;
      if (cover) await preloadImage(cover);
    },
    PREFETCH_CONCURRENCY,
  );
}

/** Dispara prefetchWalletTickets cuando cambia el listado de entradas. */
export const usePrefetchWallet = (tickets: WalletTicket[] | undefined) => {
  const qc = useQueryClient();
  const lastSig = useRef("");

  useEffect(() => {
    if (!tickets?.length) return;
    const sig = tickets
      .map((t) => t.id)
      .sort()
      .join(",");
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    void prefetchWalletTickets(qc, tickets);
  }, [tickets, qc]);
};

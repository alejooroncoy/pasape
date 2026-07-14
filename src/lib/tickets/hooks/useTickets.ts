"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, resolveUrl } from "@/lib/_shared/api-client";
import {
  checkoutSignalHeaders,
  refreshCheckoutToken,
  solvePow,
  type Challenge,
} from "@/lib/tickets/checkoutSignals";
import { PERSIST_GC_TIME_MS } from "@/lib/_shared/query-client-config";
import { useSessionReady } from "@/lib/identity/hooks/useSessionReady";
import { currentUserKey } from "@/lib/identity/hooks/useCurrentUser";
import type { Order, OrderQuote, Ticket, TransferOutcome, WalletTicket } from "@/server/tickets/domain/Ticket";

export const myTicketsKey = ["tickets", "mine"] as const;

export const ticketDetailKey = (id: string, linkToken?: string | null) =>
  ["tickets", "detail", id, linkToken ?? ""] as const;

export const carouselScopeKey = (ticketId: string) =>
  ["tickets", "carousel", ticketId] as const;

export type CarouselScope = { ids: string[]; currentIndex: number; eventTicketCount: number };

export const fetchTicketDetail = (id: string, linkToken?: string | null) => {
  const qs = linkToken ? `?k=${encodeURIComponent(linkToken)}` : "";
  return api.get<WalletTicket>(`/api/tickets/${id}${qs}`);
};

export const fetchCarouselScope = (ticketId: string) =>
  api.get<CarouselScope>(`/api/tickets/${ticketId}/carousel-scope`);

// gcTime largo (7 días): mantiene la wallet en cache para que el persister la
// conserve → disponible offline y sin parpadeo. Coincide con el maxAge del
// persister (ver query-client.tsx).
const PERSIST_GC_TIME = PERSIST_GC_TIME_MS;

export const useMyTickets = () => {
  const { sessionReady, loggedIn } = useSessionReady();

  return useQuery({
    queryKey: myTicketsKey,
    queryFn: () => api.get<WalletTicket[]>("/api/tickets/my"),
    // Sin sesión confirmada no golpeamos /my (evita 401 en bucle con cache persistido).
    enabled: sessionReady && loggedIn,
    gcTime: PERSIST_GC_TIME,
    networkMode: "offlineFirst",
    // Tope de 3 intentos: sin él, un error persistente que no sea
    // "unauthenticated" (ej. estar offline) reintenta para siempre y
    // `isLoading` se queda pegado en true — la wallet no cae nunca al dato
    // cacheado, se ve congelada en el skeleton en vez de mostrar lo que ya sabe.
    retry: (count, err) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return false;
      return count < 3 && (err as Error).message !== "unauthenticated";
    },
  });
};

export const useTicket = (id: string, linkToken?: string | null) =>
  useQuery({
    queryKey: ticketDetailKey(id, linkToken),
    queryFn: () => fetchTicketDetail(id, linkToken),
    enabled: !!id,
    gcTime: PERSIST_GC_TIME,
    networkMode: "offlineFirst",
    retry: (count) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return false;
      return count < 1;
    },
    // Mientras la entrada está ACTIVA y el holder la tiene abierta, sondeamos cada
    // 4s: apenas el portero la valida (que empuja el "usado" al server al instante),
    // la vista pasa a "Ya usada" casi en tiempo real. Al volverse usada/anulada el
    // polling se detiene solo (no hay nada más que actualizar). No corre en
    // background: solo con la pestaña enfocada (justo cuando se muestra el QR).
    refetchInterval: (query) =>
      query.state.data?.status === "active" ? 4000 : false,
  });

export type GuestBuyer = {
  email?: string | null;
  phone?: string | null;
  fullName: string;
  dni: string;
};

export type BuyInput = {
  eventId: string;
  items: Array<{ ticketTypeId: string; qty: number; holderName?: string | null }>;
  promoCode?: string | null;
  guest?: GuestBuyer;
  /** Datos del comprador logueado (mismos campos que guest, sin crear auth user).
      Se persisten en su perfil/kyc para autorrellenar la próxima compra. */
  buyer?: GuestBuyer;
};

export type BuyResult = {
  order: Order;
  tickets: Ticket[];
  preference: { id: string; initPoint: string };
  /** Llave firmada de la orden: el cliente la usa para leer el estado de su
      propia compra en /processing sin sesión ni email (guest con Yape). */
  orderToken?: string;
};

// Cotización autoritativa del pedido (modelo híbrido): el checkout muestra al
// instante el cálculo local (módulo compartido) y en cada transición de paso
// pide este quote al backend, que pisa los números locales. Ver AGENTS.md
// ("Dinero: nunca reimplementar la fórmula en el frontend").
export const useOrderQuote = () =>
  useMutation({
    mutationFn: async (input: { eventId: string; items: Array<{ ticketTypeId: string; qty: number }> }) =>
      api.post<OrderQuote>("/api/tickets/quote", input, {
        headers: await checkoutSignalHeaders(input.eventId),
      }),
  });

// POST /buy con fetch manual (no api.post) para poder LEER el body del 428
// challenge_required sin que el cliente lance. Devuelve status + payload crudo.
const postBuy = async (
  input: BuyInput,
  headers: Record<string, string>,
): Promise<{ status: number; ok: boolean; payload: { data?: BuyResult; error?: string; challenge?: Challenge } }> => {
  const res = await fetch(resolveUrl("/api/tickets/buy"), {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, payload };
};

export const useBuyTickets = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BuyInput): Promise<BuyResult> => {
      const headers = await checkoutSignalHeaders(input.eventId);
      try {
        let attempt = await postBuy(input, headers);

        // Step-up challenge TRANSPARENTE: si el server responde 428 pidiendo un PoW,
        // lo resolvemos en background (invisible para el humano) y reintentamos UNA
        // vez con la solución en x-cx-stepup, reusando el MISMO token (el 428 no lo
        // quemó). Un bot masivo paga este trabajo por cada intento sospechoso.
        if (attempt.status === 428 && attempt.payload.challenge) {
          const number = await solvePow(attempt.payload.challenge);
          if (number != null) {
            const stepup = JSON.stringify({ ...attempt.payload.challenge, number });
            attempt = await postBuy(input, { ...headers, "x-cx-stepup": stepup });
          }
        }

        if (!attempt.ok || attempt.payload.error) {
          throw new Error(attempt.payload.error ?? `HTTP ${attempt.status}`);
        }
        return attempt.payload.data as BuyResult;
      } finally {
        // El server puede haber quemado el token single-use aunque la respuesta
        // nunca llegue al cliente (fetch abortado/timeout tras procesar). Renovamos
        // SIEMPRE — éxito, error de validación, o fallo de red — para que un
        // reintento legítimo del usuario nunca reuse un token ya consumido y se
        // marque como token_replay.
        refreshCheckoutToken(input.eventId);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: myTicketsKey }),
  });
};

// Invalida todo el prefijo ["tickets"] (wallet + detalle) — el detalle usa una
// key distinta a myTicketsKey, así que el estado pendiente debe refrescar ahí.
const ticketsRoot = ["tickets"] as const;

export const useTransferTicket = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; toPhone: string }) =>
      api.post<TransferOutcome>("/api/tickets/transfer", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketsRoot }),
  });
};

export const useCancelTransfer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string }) =>
      api.post<{ ok: true }>("/api/tickets/cancel-transfer", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketsRoot }),
  });
};

// Reparto post-compra: asigna nombre/DNI del titular de una entrada propia.
export const useSetHolder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; holderName: string | null; dni?: string | null; isForeigner?: boolean }) =>
      api.post<Ticket>("/api/tickets/set-holder", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketsRoot }),
  });
};

export type RefundRequestOutcome = {
  orderId: string;
  eventTitle: string;
  amountCents: number;
  currency: string;
};

// Flujo no escalable a propósito: solo registra la solicitud y avisa por
// correo al equipo — el reembolso en sí se procesa a mano (ver TODOS.md).
export const useRequestRefund = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ticketId: string; reason: string }) =>
      api.post<RefundRequestOutcome>("/api/tickets/request-refund", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketsRoot }),
  });
};

export const useCarouselScope = (ticketId: string) =>
  useQuery({
    queryKey: carouselScopeKey(ticketId),
    queryFn: () => fetchCarouselScope(ticketId),
    enabled: !!ticketId,
    gcTime: PERSIST_GC_TIME,
    networkMode: "offlineFirst",
    retry: (count) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return false;
      return count < 1;
    },
  });

export const useClaimTransfer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; fullName?: string | null; dni?: string | null; isForeigner?: boolean }) =>
      api.post<{ ticketId: string; eventSlug: string }>("/api/tickets/claim", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketsRoot }),
  });
};

// Desbloqueo de la PROPIA compra al loguearse tras pagar como invitado.
export const useClaimOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orderId: string; token: string }) =>
      api.post<{ ticketsClaimed: number; eventSlug: string; firstTicketId: string | null }>(
        "/api/tickets/claim-order",
        input,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketsRoot });
      // El claim pudo copiar el teléfono/nombre de la orden al profile (ver
      // claimOrder en el repo) → refrescamos `me` para que la pantalla post-claim
      // no vuelva a pedir un número que ya tenemos.
      qc.invalidateQueries({ queryKey: currentUserKey });
    },
  });
};

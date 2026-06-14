"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";

// Núcleo reusable: se suscribe al Broadcast de la DB para un evento
// (trigger broadcast_event_stats_change → topic `event-stats:<eventId>`) y llama
// `onPing` (debounced ~400ms) cada vez que cambian las stats. El ping NO trae
// datos: solo señaliza que hay que refetchear (el refetch respeta RLS). Coalesce
// ráfagas (una orden de N tickets / varios scans no disparan N refetches) y
// degrada limpio: si Realtime no conecta, el polling de cada query sigue.
function useEventStatsBroadcast(
  eventId: string | null | undefined,
  onPing: () => void,
) {
  useEffect(() => {
    if (!eventId) return;
    const supabase = createSupabaseBrowserClient();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const pingSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(onPing, 400);
    };

    const channel = supabase
      .channel(`event-stats:${eventId}`)
      .on("broadcast", { event: "stats_changed" }, pingSoon)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
    // onPing se recrea cada render; lo excluimos a propósito (usa qc estable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);
}

// KPIs del panel del organizador.
export function useRealtimeEventStats(eventId: string | null | undefined, slug: string) {
  const qc = useQueryClient();
  useEventStatsBroadcast(eventId, () => {
    if (slug) void qc.invalidateQueries({ queryKey: ["events", "stats", slug] });
  });
}

// Vista del promotor: mismo Broadcast del evento, invalida sus queries para que
// vea ventas/hitos en vivo mientras vende.
export function useRealtimePromoterStats(
  eventId: string | null | undefined,
  eventSlug: string,
) {
  const qc = useQueryClient();
  useEventStatsBroadcast(eventId, () => {
    if (eventSlug) void qc.invalidateQueries({ queryKey: ["promoters", "home", eventSlug] });
    void qc.invalidateQueries({ queryKey: ["promoters", "earnings"] });
    void qc.invalidateQueries({ queryKey: ["promoters", "links"] });
  });
}

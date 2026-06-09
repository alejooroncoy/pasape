"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";

// Realtime de los KPIs del panel vía Broadcast desde la DB (trigger
// broadcast_event_stats_change → topic `event-stats:<eventId>`). El ping no
// trae datos: solo dispara un refetch del view de stats (que respeta RLS).
//
// Debounce ~400ms para coalescer ráfagas — una orden de N tickets o varios
// scans seguidos no deben disparar N refetches. Degrada limpio: si Realtime no
// conecta, el polling de useEventStats (15s) sigue cubriendo.
export function useRealtimeEventStats(eventId: string | null | undefined, slug: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!eventId || !slug) return;
    const supabase = createSupabaseBrowserClient();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidateSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["events", "stats", slug] });
      }, 400);
    };

    const channel = supabase
      .channel(`event-stats:${eventId}`)
      .on("broadcast", { event: "stats_changed" }, invalidateSoon)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [eventId, slug, qc]);
}

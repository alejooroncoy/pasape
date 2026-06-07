"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";

// Realtime sobre scan_events: refresca las stats del dashboard al instante
// cuando llega un acceso o un dup_offline. La RLS limita lo que el canal entrega
// a los eventos de la org del usuario. Degrada limpio: si Realtime no conecta,
// el polling de useEventStats (15s) sigue cubriendo.
export function useScanRealtime(slug: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!slug) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`scan-events-${slug}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "scan_events" },
        () => {
          void qc.invalidateQueries({ queryKey: ["events", "stats", slug] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [slug, qc]);
}

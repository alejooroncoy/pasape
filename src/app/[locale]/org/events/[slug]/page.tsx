import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { makeQueryClient } from "@/lib/_shared/query-client-config";
import { serverApiGet } from "@/lib/_shared/server-api";
import type { Event, Promo, TicketType } from "@/server/events/domain/Event";
import { EventPanelClient } from "./EventPanelClient";

type Params = Promise<{ slug: string; locale: string }>;
type EventDetail = { event: Event; ticketTypes: TicketType[]; promos: Promo[] };

// El panel del evento vive en el cliente (realtime, sheets, tabs). Este server
// component solo mira el estado ANTES de renderizarlo: un evento finalizado no
// tiene panel operativo — su reporte definitivo vive en /org/reports. Redirige
// (307) con el evento ya seleccionado por la URL, sin flash del dashboard. De
// paso hidrata el detalle para que el cliente no vuelva a pedirlo.
export default async function OrgEventPanelPage({ params }: { params: Params }) {
  const { slug, locale } = await params;

  const qc = makeQueryClient();
  let detail: EventDetail | null = null;
  try {
    detail = await serverApiGet<EventDetail>(`/api/events/${slug}`);
    qc.setQueryData(["events", "detail", slug], detail);
  } catch {
    // Fetch server falló (red/transitorio) → el cliente hace su propio fetch y
    // maneja el error. No bloqueamos el panel por esto.
  }

  // Fuera del try: redirect() lanza NEXT_REDIRECT y un catch se lo tragaría.
  if (detail?.event.status === "closed") {
    redirect(`/${locale}/org/reports?event=${encodeURIComponent(slug)}`);
  }

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <EventPanelClient params={params} />
    </HydrationBoundary>
  );
}

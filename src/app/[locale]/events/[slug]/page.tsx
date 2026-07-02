import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/_shared/query-client-config";
import { serverApiGet } from "@/lib/_shared/server-api";
import type { MeResponse } from "@/lib/identity/hooks/useCurrentUser";
import { IdentityController } from "@/server/identity/controllers/rest/IdentityController";
import type { Event, Promo, TicketType } from "@/server/events/domain/Event";
import { EventDetailClient } from "./EventDetailClient";

type EventDetailResponse = { event: Event; ticketTypes: TicketType[]; promos: Promo[] };

// Comprar SIEMPRE requiere internet (pago), así que no hay ganancia en cargar
// esta página offline-first — a diferencia de home/wallet, acá conviene
// prefetchear en el server: el flyer y su paleta llegan resueltos en el
// primer HTML en vez de pintar negro plano hasta que el cliente haga fetch.
//
// También prefetcheamos la sesión — pero llamando directo a `IdentityController.me()`
// (misma función que usa la ruta /api/identity/me), NO por fetch HTTP a nuestra
// propia API: ya estamos en el servidor, con la cookie de Supabase disponible
// en este mismo proceso (`getAuthContext()`), así que ida-y-vuelta por HTTP
// sería puro overhead. Si hay sesión, el header llega YA autenticado en el
// primer HTML (sin el parpadeo "Ingresar" → avatar). El cache de IndexedDB
// del cliente (offline) sigue siendo el fallback para cuando no hay cookie
// válida o la red falla — no lo reemplaza, solo evita depender de él acá.
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const qc = makeQueryClient();
  await Promise.all([
    qc.prefetchQuery({
      queryKey: ["events", "detail", slug],
      queryFn: () => serverApiGet<EventDetailResponse>(`/api/events/${slug}`),
    }),
    qc.prefetchQuery({
      // Array literal propio (no el `currentUserKey` importado del hook): al
      // referenciar el mismo array module-level, el serializador RSC lo
      // manda por referencia ("$ed") en vez de inline, y algo en esa vuelta
      // llega al cliente como string → "queryKey needs to be an Array".
      // `useCurrentUser` sigue usando la misma tupla ["identity","me"], así
      // que el queryHash calza igual y la hidratación encuentra la entrada.
      queryKey: ["identity", "me"],
      queryFn: async (): Promise<MeResponse> => {
        const result = await IdentityController.me();
        return result.ok ? result.value : null;
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <EventDetailClient slug={slug} />
    </HydrationBoundary>
  );
}

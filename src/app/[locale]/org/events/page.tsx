import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getAuthContext, resolveActiveOrgSlug } from "@/server/_shared/AuthContext";
import { makeQueryClient } from "@/lib/_shared/query-client-config";
import { serverApiGet } from "@/lib/_shared/server-api";
import type { Event } from "@/server/events/domain/Event";
import { OrgEventsClient } from "./_components/OrgEventsClient";

// Híbrido: el server resuelve la marca activa y prefetcha los eventos llamando a
// nuestra propia API (no al repo) → la data viaja con el HTML y React Query la
// hidrata. El cliente sigue manejando refetch/realtime. Sin waterfall, sin
// skeleton en cada entrada.
export default async function OrgEventsPage() {
  const auth = await getAuthContext();
  const slug = auth.ok ? await resolveActiveOrgSlug(auth.value.profileId) : null;

  const qc = makeQueryClient();
  if (slug) {
    await qc.prefetchQuery({
      queryKey: ["events", "mine", slug],
      queryFn: () => serverApiGet<Event[]>("/api/events?scope=mine"),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <OrgEventsClient initialOrgSlug={slug} />
    </HydrationBoundary>
  );
}

import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { setRequestLocale } from "next-intl/server";
import { HomeClient } from "../_home/HomeClient";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";
import { makeQueryClient } from "@/lib/_shared/query-client-config";
import { BROWSE_EVENTS_LIMIT } from "@/lib/events/constants";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { EventsController } from "@/server/events/controllers/rest/EventsController";

// Ruta temporal de comparación (no indexable, no linkeada desde la nav):
// mismo home, variante "oscuro ambiental" a la Partiful, para decidir contra
// la variante "blanco + wash" que vive en "/".
export const metadata = { robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomeVariant2Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [user, eventsResult] = await Promise.all([
    getSessionUser(),
    EventsController.listPublic({ limit: BROWSE_EVENTS_LIMIT }),
  ]);

  const qc = makeQueryClient();
  if (eventsResult.ok) {
    qc.setQueryData(["events", "browse", null], eventsResult.value);
  }

  const lcpCover = eventsResult.ok
    ? optimizeImageUrl(eventsResult.value[0]?.coverUrl, "card")
    : null;

  return (
    <>
      {lcpCover ? <link rel="preload" as="image" href={lcpCover} fetchPriority="high" /> : null}
      <HydrationBoundary state={dehydrate(qc)}>
        <HomeClient
          user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
          variant="dark-ambient"
        />
      </HydrationBoundary>
    </>
  );
}

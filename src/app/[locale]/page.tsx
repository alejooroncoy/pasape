import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { setRequestLocale } from "next-intl/server";
import { HomeClient } from "./_home/HomeClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { HOME_TITLE, DEFAULT_DESCRIPTION } from "@/lib/seo/site";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";
import { makeQueryClient } from "@/lib/_shared/query-client-config";
import { BROWSE_EVENTS_LIMIT } from "@/lib/events/constants";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { EventsController } from "@/server/events/controllers/rest/EventsController";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: HOME_TITLE,
    description: DEFAULT_DESCRIPTION,
    locale,
    path: "/",
  });
}

export default async function HomePage({ params }: Props) {
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

  // Mismo preset que usa FeaturedBanner.tsx para pintar esta misma imagen — si
  // no coinciden, la URL del preload no matchea la del <img> real y el navegador
  // descarga la imagen dos veces (una por preset) en vez de reusar el preload.
  const lcpCover = eventsResult.ok
    ? optimizeImageUrl(eventsResult.value[0]?.coverUrl, "hero-lcp")
    : null;

  return (
    <>
      {lcpCover ? <link rel="preload" as="image" href={lcpCover} fetchPriority="high" /> : null}
      <HydrationBoundary state={dehydrate(qc)}>
        <h1 className="sr-only">Pasape — Compra entradas para eventos en Perú</h1>
        <HomeClient
          user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
        />
      </HydrationBoundary>
    </>
  );
}

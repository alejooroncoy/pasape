import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { HomeClient } from "@/app/[locale]/_home/HomeClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import {
  EVENTOS_LANDING_BY_SLUG,
  type EventosLandingSlug,
} from "@/lib/seo/pages";
import { makeQueryClient } from "@/lib/_shared/query-client-config";
import { BROWSE_EVENTS_LIMIT } from "@/lib/events/constants";
import { listPublishedEvents } from "@/server/events/application/ListPublishedEvents";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";

type Props = {
  params: Promise<{ locale: string; category: string }>;
};

export async function generateStaticParams() {
  return Object.keys(EVENTOS_LANDING_BY_SLUG).map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const landing = EVENTOS_LANDING_BY_SLUG[category as EventosLandingSlug];
  if (!landing) return {};

  return buildPageMetadata({
    title: landing.title,
    description: landing.description,
    locale,
    path: `/eventos/${landing.slug}`,
  });
}

export default async function EventosCategoryPage({ params }: Props) {
  const { locale, category } = await params;
  const landing = EVENTOS_LANDING_BY_SLUG[category as EventosLandingSlug];
  if (!landing) notFound();

  setRequestLocale(locale);

  const [user, events, allEvents] = await Promise.all([
    getSessionUser(),
    listPublishedEvents({ repo }, { limit: BROWSE_EVENTS_LIMIT, category: landing.category }),
    listPublishedEvents({ repo }, { limit: BROWSE_EVENTS_LIMIT }),
  ]);

  const qc = makeQueryClient();
  qc.setQueryData(["events", "browse", landing.category], events);
  // Pills de categoría en HomeClient leen useBrowseEvents(null)
  qc.setQueryData(["events", "browse", null], allEvents);

  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    { name: landing.h1, path: `/eventos/${landing.slug}` },
  ];

  return (
    <>
      <JsonLd data={itemListJsonLd(events, landing.h1, locale)} />
      <HydrationBoundary state={dehydrate(qc)}>
        <HomeClient
          user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
          initialCategory={landing.category}
          showHero={false}
          searchLocation={`eventos-${landing.slug}`}
          seoLead={{
            h1: landing.h1,
            description: landing.description,
            breadcrumbs: <Breadcrumbs items={breadcrumbs} />,
            category: landing.category,
          }}
        />
      </HydrationBoundary>
    </>
  );
}

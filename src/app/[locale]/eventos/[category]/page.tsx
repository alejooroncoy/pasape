import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { EventosGrid } from "@/components/eventos/EventosGrid";
import { EventosPageShell } from "@/components/eventos/EventosPageShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import {
  EVENTOS_HUB,
  EVENTOS_LANDING_BY_SLUG,
  type EventosLandingSlug,
} from "@/lib/seo/pages";
import { listPublishedEvents } from "@/server/events/application/ListPublishedEvents";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";

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

  const events = await listPublishedEvents(
    { repo },
    { limit: 100, category: landing.category },
  );

  return (
    <EventosPageShell
      locale={locale}
      breadcrumbs={[
        { name: "Inicio", path: "/" },
        { name: "Eventos", path: EVENTOS_HUB.path },
        { name: landing.h1, path: `/eventos/${landing.slug}` },
      ]}
      h1={landing.h1}
      description={landing.description}
    >
      <JsonLd data={itemListJsonLd(events, landing.h1, locale)} />
      <EventosGrid
        events={events}
        emptyMessage={`Aún no hay eventos de ${landing.h1.toLowerCase()} publicados. Vuelve pronto.`}
      />
    </EventosPageShell>
  );
}

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { EventosGrid } from "@/components/eventos/EventosGrid";
import { EventosPageShell } from "@/components/eventos/EventosPageShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { filterEventsByQuery } from "@/lib/seo/filterEvents";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { EVENTOS_HUB } from "@/lib/seo/pages";
import { listPublishedEvents } from "@/server/events/application/ListPublishedEvents";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: EVENTOS_HUB.title,
    description: EVENTOS_HUB.description,
    locale,
    path: EVENTOS_HUB.path,
  });
}

export default async function EventosHubPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);

  const allEvents = await listPublishedEvents({ repo }, { limit: 100 });
  const events = filterEventsByQuery(allEvents, q);

  return (
    <EventosPageShell
      locale={locale}
      breadcrumbs={[
        { name: "Inicio", path: "/" },
        { name: "Eventos", path: EVENTOS_HUB.path },
      ]}
      h1={EVENTOS_HUB.h1}
      description={EVENTOS_HUB.description}
    >
      <JsonLd data={itemListJsonLd(events, EVENTOS_HUB.h1, locale)} />
      {q?.trim() ? (
        <p className="mt-6 text-[14px] text-cart-ink-3">
          Resultados para &ldquo;{q.trim()}&rdquo; ({events.length})
        </p>
      ) : null}
      <EventosGrid events={events} />
    </EventosPageShell>
  );
}

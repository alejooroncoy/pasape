import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { EventosGrid } from "@/components/eventos/EventosGrid";
import { EventosPageShell } from "@/components/eventos/EventosPageShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { EVENTOS_HUB, EVENTOS_LIMA } from "@/lib/seo/pages";
import { listPublishedEvents } from "@/server/events/application/ListPublishedEvents";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: EVENTOS_LIMA.title,
    description: EVENTOS_LIMA.description,
    locale,
    path: EVENTOS_LIMA.path,
  });
}

export default async function EventosLimaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const events = await listPublishedEvents({ repo }, { limit: 100 });

  return (
    <EventosPageShell
      locale={locale}
      breadcrumbs={[
        { name: "Inicio", path: "/" },
        { name: "Eventos", path: EVENTOS_HUB.path },
        { name: "Lima", path: EVENTOS_LIMA.path },
      ]}
      h1={EVENTOS_LIMA.h1}
      description={EVENTOS_LIMA.description}
    >
      <JsonLd data={itemListJsonLd(events, EVENTOS_LIMA.h1, locale)} />
      <EventosGrid events={events} />
    </EventosPageShell>
  );
}

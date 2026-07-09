import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { HomeClient } from "@/app/[locale]/_home/HomeClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { itemListJsonLd } from "@/lib/seo/jsonld";
import { EVENTOS_LIMA } from "@/lib/seo/pages";
import { listPublishedEvents } from "@/server/events/application/ListPublishedEvents";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";

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

  const user = await getSessionUser();
  const events = await listPublishedEvents({ repo }, { limit: 100 });
  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    { name: "Lima", path: EVENTOS_LIMA.path },
  ];

  return (
    <>
      <JsonLd data={itemListJsonLd(events, EVENTOS_LIMA.h1, locale)} />
      <HomeClient
        user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
        showHero={false}
        searchLocation="eventos-lima"
        seoLead={{
          h1: EVENTOS_LIMA.h1,
          description: EVENTOS_LIMA.description,
          breadcrumbs: <Breadcrumbs items={breadcrumbs} />,
        }}
      />
    </>
  );
}

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { PRIVACIDAD_PAGE } from "@/lib/seo/pages";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";
import { PrivacidadClient } from "./PrivacidadClient";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: PRIVACIDAD_PAGE.title,
    description: PRIVACIDAD_PAGE.description,
    locale,
    path: PRIVACIDAD_PAGE.path,
  });
}

export default async function PrivacidadPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    { name: "Política de Privacidad", path: PRIVACIDAD_PAGE.path },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs, locale)} />
      <PrivacidadClient
        user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
        breadcrumbs={breadcrumbs}
      />
    </>
  );
}

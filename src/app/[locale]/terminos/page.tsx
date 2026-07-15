import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { TERMINOS_PAGE } from "@/lib/seo/pages";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";
import { TerminosClient } from "./TerminosClient";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: TERMINOS_PAGE.title,
    description: TERMINOS_PAGE.description,
    locale,
    path: TERMINOS_PAGE.path,
  });
}

export default async function TerminosPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    { name: "Términos y Condiciones", path: TERMINOS_PAGE.path },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs, locale)} />
      <TerminosClient
        user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
        breadcrumbs={breadcrumbs}
      />
    </>
  );
}

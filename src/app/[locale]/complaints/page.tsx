import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";
import { LibroReclamacionesClient } from "./LibroReclamacionesClient";

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLE = "Libro de Reclamaciones";
const DESCRIPTION =
  "Registra tu reclamo o queja. Cumplimos con el Código de Protección y Defensa del Consumidor (Ley 29571). Te respondemos en un máximo de 15 días hábiles.";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: TITLE,
    description: DESCRIPTION,
    locale,
    path: "/complaints",
  });
}

export default async function LibroDeReclamacionesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    { name: "Libro de Reclamaciones", path: "/complaints" },
  ];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(breadcrumbs, locale)} />
      <LibroReclamacionesClient
        user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
      />
    </>
  );
}

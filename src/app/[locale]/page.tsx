import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { HomeClient } from "./_home/HomeClient";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { HOME_TITLE, DEFAULT_DESCRIPTION } from "@/lib/seo/site";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";

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

  const user = await getSessionUser();
  return (
    <>
      <h1 className="sr-only">Pasape — Compra entradas para eventos en Perú</h1>
      <HomeClient
        user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
      />
    </>
  );
}

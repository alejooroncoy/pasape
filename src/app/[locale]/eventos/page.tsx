import { redirect } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

// El listado vive en la home (/es). Esta ruta queda como alias SEO que
// consolidamos en la portada para no duplicar UI ni contenido indexable.
export default async function EventosHubRedirectPage({ params }: Props) {
  const { locale } = await params;
  redirect({ href: "/", locale });
}

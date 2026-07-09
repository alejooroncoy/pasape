import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { AYUDA_PAGE } from "@/lib/seo/pages";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";
import { AyudaClient } from "./AyudaClient";

type Props = {
  params: Promise<{ locale: string }>;
};

const FAQS = [
  {
    q: "¿Cómo compro entradas?",
    a: "Elige un evento, selecciona tus entradas y paga con tarjeta o Yape. Recibirás tus tickets digitales con QR al instante.",
  },
  {
    q: "¿Dónde veo mi entrada?",
    a: "Ingresa a Pasape con tu cuenta y abre la sección Mis entradas. También puedes acceder desde el correo de confirmación.",
  },
  {
    q: "¿Puedo transferir mi entrada?",
    a: "Depende de las reglas del evento. Si está habilitado, podrás transferir desde el detalle de tu ticket antes del límite indicado.",
  },
  {
    q: "¿Cómo organizo un evento?",
    a: "Visita la página de organizadores para crear tu evento, configurar entradas y activar ventas tras la revisión de Pasape.",
  },
] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: AYUDA_PAGE.title,
    description: AYUDA_PAGE.description,
    locale,
    path: AYUDA_PAGE.path,
  });
}

export default async function AyudaPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  const breadcrumbs = [
    { name: "Inicio", path: "/" },
    { name: "Ayuda", path: AYUDA_PAGE.path },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={[breadcrumbJsonLd(breadcrumbs, locale), faqJsonLd]} />
      <AyudaClient
        user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
        breadcrumbs={breadcrumbs}
        h1={AYUDA_PAGE.h1}
        description={AYUDA_PAGE.description}
        faqs={FAQS}
      />
    </>
  );
}

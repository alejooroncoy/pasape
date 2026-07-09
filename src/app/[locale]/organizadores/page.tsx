import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ComoFunciona } from "./components/como-funciona";
import { Faq, FAQS } from "./components/faq";
import { SiteFooter } from "./components/footer";
import { FormSection } from "./components/form-section";
import { Hero } from "./components/hero";
import { Nav } from "./components/nav";
import { PanelReporte } from "./components/panel-reporte";
import { Price } from "./components/price";
import { Problema } from "./components/problema";
import { Promos } from "./components/promos";
import { RevealObserver } from "./components/reveal-observer";
import { WaFloat } from "./components/wa-float";
import { WA_HREF } from "./components/wa";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/site";
import "./landing.css";

type Props = {
  params: Promise<{ locale: string }>;
};

const ORG_TITLE = "Sistema operativo para eventos";
const ORG_DESCRIPTION =
  "Vende entradas, gestiona pagos, QR, boxes, cortesías, reportes y control de acceso desde un solo lugar.";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: ORG_TITLE,
    description: ORG_DESCRIPTION,
    locale,
    path: "/organizadores",
  });
}

export default async function OrganizadoresPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Pasape",
        url: SITE_URL,
        logo: `${SITE_URL}/icon`,
        description:
          "Sistema operativo para vender, gestionar y controlar eventos con entradas digitales, pagos, QR, boxes, cortesías y reportes.",
        areaServed: "PE",
      },
      {
        "@type": "WebSite",
        url: SITE_URL,
        name: "Pasape",
        inLanguage: "es-PE",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Nav waHref={WA_HREF} />
      <main>
        <Hero waHref={WA_HREF} />
        <Problema />
        <Promos />
        <PanelReporte />
        <ComoFunciona />
        <Price waHref={WA_HREF} />
        <Faq />
        <FormSection waHref={WA_HREF} />
      </main>
      <SiteFooter />
      <WaFloat waHref={WA_HREF} />
      <RevealObserver />
    </>
  );
}

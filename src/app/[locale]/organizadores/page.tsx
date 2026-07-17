import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ComoFunciona } from "./components/como-funciona";
import { Faq } from "./components/faq";
import { FAQS } from "./components/faq-data";
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

const ORG_TITLE = "Vende tu evento sin Excel ni lista en la puerta";
const ORG_DESCRIPTION =
  "Para organizadores de fiestas, conciertos, charlas y eventos universitarios que hoy venden por WhatsApp y Yape. Cada entrada con su QR, tus promotores y boxes ordenados, y una puerta que ya no busca nombres en una lista de cientos.";

const ORG_KEYWORDS = [
  "vender entradas para eventos",
  "vender entradas para fiestas",
  "sistema de entradas para eventos universitarios",
  "vender entradas por WhatsApp",
  "ticketera para fiestas y eventos",
  "QR para control de acceso eventos",
  "vender boxes y mesas para eventos",
  "software para organizadores de eventos Perú",
  "reemplazar Excel para vender entradas",
  "cobrar entradas con Yape y Plin",
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: ORG_TITLE,
    description: ORG_DESCRIPTION,
    locale,
    path: "/organizadores",
    keywords: ORG_KEYWORDS,
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
          "Pasape ayuda a organizadores de fiestas, conciertos, charlas y eventos universitarios a vender entradas con QR, ordenar promotores y boxes, y controlar el acceso en la puerta.",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="home-light home-wash cart-grain relative min-h-screen bg-cart-bg font-sans text-cart-ink">
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
      </div>
    </>
  );
}

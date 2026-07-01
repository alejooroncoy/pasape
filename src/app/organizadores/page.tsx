import type { Metadata } from "next";
import { Audience } from "./components/audience";
import { Combos } from "./components/combos";
import { ComoFunciona } from "./components/como-funciona";
import { Faq, FAQS } from "./components/faq";
import { SiteFooter } from "./components/footer";
import { FormSection } from "./components/form-section";
import { Hero } from "./components/hero";
import { Nav } from "./components/nav";
import { PanelReporte } from "./components/panel-reporte";
import { PilotoInclude } from "./components/piloto-include";
import { Price } from "./components/price";
import { Problema } from "./components/problema";
import { Promos } from "./components/promos";
import { RevealObserver } from "./components/reveal-observer";
import { WaFloat } from "./components/wa-float";
import { WA_HREF } from "./components/wa";
import "./landing.css";

const SITE_URL = "https://pasa.pe";

export const metadata: Metadata = {
  title: "Pasape | Entradas digitales para organizadores",
  description:
    "Vende entradas, combos, preventas y boxes sin responder un solo DM. Mide a tus promotores en tiempo real.",
};

export default function OrganizadoresPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Pasape",
        url: SITE_URL,
        logo: `${SITE_URL}/icon`,
        description:
          "Entradas digitales con QR, combos y medición de promotores para fiestas y eventos en Perú.",
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
        <Combos />
        <PanelReporte />
        <ComoFunciona />
        <PilotoInclude />
        <Price waHref={WA_HREF} />
        <Audience />
        <Faq />
        <FormSection waHref={WA_HREF} />
      </main>
      <SiteFooter />
      <WaFloat waHref={WA_HREF} />
      <RevealObserver />
    </>
  );
}

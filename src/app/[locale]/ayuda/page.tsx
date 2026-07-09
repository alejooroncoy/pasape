import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { Logo } from "@/components/brand/Logo";
import { Footer } from "@/app/[locale]/_home/Footer";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { AYUDA_PAGE } from "@/lib/seo/pages";

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
    <div className="cart-grain relative min-h-screen bg-cart-bg text-white font-sans">
      <header className="border-b border-cart-line px-[clamp(20px,4vw,56px)] py-5">
        <div className="mx-auto flex max-w-[900px] items-center gap-2.5">
          <Link href="/" className="inline-flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.01em] text-white">
            <span className="grid size-[34px] place-items-center">
              <Logo className="size-full" />
            </span>
            Pasape
          </Link>
        </div>
      </header>

      <main className="px-[clamp(20px,4vw,56px)] py-10">
        <div className="mx-auto max-w-[900px]">
          <JsonLd data={[breadcrumbJsonLd(breadcrumbs, locale), faqJsonLd]} />
          <Breadcrumbs items={breadcrumbs} />
          <h1 className="mt-4 text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.03em]">
            {AYUDA_PAGE.h1}
          </h1>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-cart-ink-3">
            {AYUDA_PAGE.description}
          </p>

          <section aria-labelledby="faq-heading" className="mt-10">
            <h2 id="faq-heading" className="text-[20px] font-semibold text-white">
              Preguntas frecuentes
            </h2>
            <dl className="mt-5 space-y-5">
              {FAQS.map(({ q, a }) => (
                <div key={q} className="rounded-2xl border border-cart-line bg-cart-bg-elev/40 p-5">
                  <dt className="text-[15px] font-medium text-white">{q}</dt>
                  <dd className="mt-2 text-[14px] leading-relaxed text-cart-ink-3">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="links-heading" className="mt-10">
            <h2 id="links-heading" className="text-[20px] font-semibold text-white">
              Más recursos
            </h2>
            <ul className="mt-4 flex list-none flex-col gap-2 p-0 text-[14px] text-cart-ink-2">
              <li>
                <Link href="/eventos" className="hover:text-white">
                  Ver eventos
                </Link>
              </li>
              <li>
                <Link href="/organizadores" className="hover:text-white">
                  Soy organizador
                </Link>
              </li>
              <li>
                <Link href="/complaints" className="hover:text-white">
                  Libro de reclamaciones
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

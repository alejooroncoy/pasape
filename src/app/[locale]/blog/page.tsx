import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { BlogChrome } from "./_components/BlogChrome";
import { BLOG_POSTS } from "./_components/posts";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: "Blog para organizadores de eventos",
    description: "Guías prácticas y novedades de Pasape para organizar, vender y operar eventos en Perú.",
    locale,
    path: "/blog",
    keywords: ["organizar eventos Perú", "vender entradas", "MCP eventos", "Pasape"],
  });
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <BlogChrome>
      <div>
        <section className="relative isolate overflow-hidden border-b border-cart-line bg-[radial-gradient(ellipse_95%_100%_at_65%_-20%,rgba(124,58,237,.30),transparent_66%),radial-gradient(ellipse_70%_85%_at_100%_20%,rgba(184,124,255,.13),transparent_70%),linear-gradient(180deg,rgba(255,255,255,.02),transparent)]">
          <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cart-accent">El cuaderno de Pasape</p>
            <h1 className="mt-5 max-w-[790px] text-4xl font-semibold tracking-[-0.05em] text-cart-ink sm:text-6xl">
              Menos vueltas. Más evento.
            </h1>
            <p className="mt-6 max-w-[680px] text-lg leading-8 text-cart-ink-2">
              Notas de lo que estamos construyendo y aprendiendo con quienes producen eventos en Perú: ventas por WhatsApp, pagos por Yape, listas, invitados y una puerta que tiene que avanzar.
            </p>
            <p className="mt-7 max-w-[650px] border-l-2 border-cart-accent pl-4 text-[15px] leading-7 text-cart-ink-3">
              Pasape no busca sumar otro panel a tu noche. Busca ordenar lo que ya sucede para que tú puedas volver a mirar el evento, no una hoja de cálculo.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-7 flex items-end justify-between gap-5">
            <div><p className="text-sm font-semibold uppercase tracking-[.14em] text-cart-ink-3">Notas recientes</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em] text-cart-ink sm:text-3xl">Lo que vale la pena dejar por escrito.</h2></div>
            <span className="hidden text-sm text-cart-ink-3 sm:block">Hecho en Perú, pensado para la cancha.</span>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {BLOG_POSTS.map((post, index) => (
              <article key={post.slug} className={`group relative overflow-hidden rounded-[28px] border border-cart-line p-7 transition hover:-translate-y-0.5 hover:border-cart-line-strong ${index === 0 ? "bg-[linear-gradient(145deg,rgba(124,58,237,.24),rgba(20,18,32,.04))]" : "bg-cart-bg-elev/45"}`}>
                <span aria-hidden className="absolute right-6 top-4 font-mono text-5xl font-semibold tracking-[-.08em] text-cart-ink/[.07]">0{index + 1}</span>
                <p className="pr-12 text-sm font-semibold text-cart-accent">{post.category}</p>
                <p className="mt-4 max-w-[42ch] text-sm leading-6 text-cart-ink-3">{post.note}</p>
                <h2 className="mt-5 max-w-[18ch] text-2xl font-semibold tracking-[-0.035em] text-cart-ink sm:text-3xl">{post.title}</h2>
                <p className="mt-4 max-w-[56ch] text-[15px] leading-7 text-cart-ink-2">{post.description}</p>
                <div className="mt-8 flex items-center justify-between gap-4 text-sm text-cart-ink-2">
                  <span>{post.readingTime}</span>
                  <Link href={`/blog/${post.slug}`} className="font-semibold text-cart-ink transition-colors group-hover:text-cart-accent">
                    Leer artículo <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </BlogChrome>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { BlogChrome } from "../_components/BlogChrome";
import { BLOG_POSTS, getPost } from "../_components/posts";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return BLOG_POSTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return buildPageMetadata({
    title: post.title,
    description: post.description,
    locale,
    path: `/blog/${post.slug}`,
    ogType: "article",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = getPost(slug);
  if (!post) notFound();

  const article = post.slug === "mcp-para-organizadores" ? <McpArticle /> : <CreateEventArticle />;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: "2026-07-18",
    dateModified: "2026-07-18",
    author: { "@type": "Organization", name: "Pasape" },
    publisher: { "@type": "Organization", name: "Pasape" },
  };

  return (
    <BlogChrome>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <article className="mx-auto max-w-[800px] px-5 py-12 sm:px-8 sm:py-20">
          <Link href="/blog" className="text-sm font-semibold text-cart-ink-2 transition-colors hover:text-cart-ink">← Volver al blog</Link>
          <p className="mt-10 text-sm font-semibold uppercase tracking-[0.15em] text-cart-accent">{post.category}</p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.06] tracking-[-0.05em] text-cart-ink sm:text-6xl">{post.title}</h1>
          <p className="mt-6 max-w-[680px] text-lg leading-8 text-cart-ink-2">{post.description}</p>
          <p className="mt-6 text-sm text-cart-ink-3">{post.publishedAt} · {post.readingTime}</p>
          <div className="mt-12 border-t border-cart-line pt-10">{article}</div>
        </article>
    </BlogChrome>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-11"><h2 className="text-2xl font-semibold tracking-[-0.03em] text-cart-ink sm:text-3xl">{title}</h2><div className="mt-4 space-y-4 text-[17px] leading-8 text-cart-ink-2">{children}</div></section>;
}

function McpArticle() {
  return <>
    <p className="text-[18px] leading-8 text-cart-ink-2">Pasape MCP permite conectar tu organización de Pasape a un asistente de IA compatible con MCP. En vez de abrir varias pantallas para armar el evento, puedes pedirle que lo prepare contigo en una conversación y mantener el control final desde Pasape.</p>
    <Link href="/mcp" className="mt-8 block rounded-[24px] bg-cart-ink p-1 transition-transform hover:-translate-y-0.5"><div className="rounded-[20px] bg-cart-bg px-6 py-7"><p className="text-sm font-semibold uppercase tracking-[.14em] text-cart-accent">Ver la demo</p><p className="mt-2 text-xl font-semibold tracking-[-.03em] text-cart-ink">Mira Pasape MCP en acción →</p><p className="mt-2 leading-7 text-cart-ink-2">Una vista animada de cómo se crea y opera un evento conversando.</p></div></Link>
    <Section title="¿Qué puedes hacer?">
      <ul className="space-y-3 pl-5 marker:text-cart-accent"><li>Crear eventos en borrador con fecha, lugar, categoría y tipos de entrada.</li><li>Editar información, portada, entradas, promociones, zonas y equipo del evento.</li><li>Revisar ventas, inscritos y el movimiento de accesos durante el evento.</li><li>Publicar un evento solo cuando ya revisaste la información.</li></ul>
    </Section>
    <Section title="Conecta tu organización">
      <p>En tu cliente MCP agrega la URL de Pasape. Al conectarte, iniciarás sesión con tu cuenta y eliges la organización a la que el asistente podrá acceder.</p>
      <div className="overflow-x-auto rounded-2xl border border-cart-line bg-cart-bg-elev px-5 py-4 font-mono text-sm text-cart-ink">https://pasape.lat/api/mcp</div>
      <p>Pasape usa autorización OAuth: no necesitas copiar una clave privada para conectar tu cuenta. Cada acción queda limitada a la organización que autorices.</p>
    </Section>
    <Section title="Una forma práctica de empezar">
      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev/55 p-6 text-cart-ink"><p className="font-medium">“Crea un borrador para una fiesta el sábado 15 de agosto en Barranco, con preventa a S/20 y general a S/30. Déjalo sin publicar para revisarlo.”</p></div>
      <p>El asistente puede preparar el borrador; tú revisas los datos y decides cuándo publicarlo. Los datos bancarios y la configuración de cobro se siguen gestionando desde la web de Pasape.</p>
    </Section>
    <div className="mt-12 rounded-[24px] border border-cart-line bg-[linear-gradient(135deg,rgba(124,58,237,.22),rgba(124,58,237,.04))] p-7"><h2 className="text-2xl font-semibold tracking-[-0.03em] text-cart-ink">Tu operación, más cerca de donde ya trabajas.</h2><p className="mt-3 max-w-[52ch] leading-7 text-cart-ink-2">El MCP está pensado para reducir pasos, no para quitarte control. Crea una organización y prueba el flujo con un evento real.</p><Link href="/org" className="mt-6 inline-flex rounded-full bg-cart-accent px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105">Abrir panel de organizador →</Link></div>
  </>;
}

function CreateEventArticle() {
  return <>
    <p className="text-[18px] leading-8 text-cart-ink-2">Publicar un evento no tiene por qué empezar con una hoja de cálculo. En Pasape puedes preparar el evento, definir entradas y ordenar el acceso desde un solo lugar.</p>
    <Section title="1. Entra a tu panel de organizador">
      <p>Ingresa a Pasape y crea —o elige— la organización que publicará el evento. La marca es quien aparece frente a los asistentes y desde ahí administras tus eventos.</p>
    </Section>
    <Section title="2. Crea el borrador con lo esencial">
      <p>Empieza con nombre, fecha y hora, lugar, categoría y una descripción breve. Puedes volver a editar el borrador antes de publicarlo; es mejor tener una base clara que esperar a que cada detalle esté perfecto.</p>
    </Section>
    <Section title="3. Define cómo ingresan tus asistentes">
      <p>Agrega los tipos de entrada que necesitas: preventa, general, VIP o boxes. Define el precio y el cupo de cada uno. Para un evento gratuito también puedes usar RSVP y, cuando aplique, revisar solicitudes antes de emitir el QR.</p>
    </Section>
    <Section title="4. Sube la portada y revisa el evento">
      <p>Una portada clara ayuda a que el evento se reconozca al compartirlo. Antes de publicarlo, verifica fecha, lugar, precios y capacidad. Esa es la información que verá quien compre.</p>
    </Section>
    <Section title="5. Publica, comparte y prepara la puerta">
      <p>Al publicar tendrás una página para compartir. Las entradas se entregan con QR; desde el panel también puedes revisar ventas, sumar a tu equipo y generar el enlace de puerta para controlar accesos.</p>
    </Section>
    <div className="mt-12 rounded-[24px] border border-cart-line bg-cart-bg-elev/60 p-7"><h2 className="text-2xl font-semibold tracking-[-0.03em] text-cart-ink">¿Listo para preparar el tuyo?</h2><p className="mt-3 leading-7 text-cart-ink-2">Puedes crear un borrador ahora y publicar cuando todo esté listo.</p><Link href="/org" className="mt-6 inline-flex rounded-full bg-cart-accent px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105">Crear mi evento →</Link></div>
  </>;
}

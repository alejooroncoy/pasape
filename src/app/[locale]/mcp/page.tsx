import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { BlogChrome } from "../blog/_components/BlogChrome";
import { McpDemo } from "./_components/McpDemo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata({
    title: "Pasape MCP para organizadores de eventos",
    description: "Conecta Pasape a tu asistente de IA para preparar eventos, configurar entradas y revisar la operación conversando.",
    locale,
    path: "/mcp",
  });
}

export default async function McpPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <BlogChrome><div className="overflow-hidden"><section className="mx-auto max-w-[1120px] px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24"><div className="mx-auto max-w-[790px] text-center"><p className="text-sm font-semibold uppercase tracking-[.15em] text-cart-accent">Pasape MCP</p><h1 className="mt-5 text-4xl font-semibold leading-[1.03] tracking-[-.055em] text-cart-ink sm:text-6xl">Tu operación de eventos, dentro de la conversación donde ya trabajas.</h1><p className="mx-auto mt-6 max-w-[650px] text-lg leading-8 text-cart-ink-2">Conecta Pasape a un asistente compatible con MCP. Prepara eventos, configura entradas y revisa el estado de tu operación sin saltar entre pantallas.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/org" className="rounded-full bg-cart-accent px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105">Conectar mi organización →</Link><Link href="/blog/mcp-para-organizadores" className="rounded-full border border-cart-line px-5 py-3 text-sm font-semibold text-cart-ink transition hover:bg-cart-bg-elev">Leer la guía</Link></div></div><div className="mx-auto mt-14 max-w-[920px]"><McpDemo /></div></section><section className="border-y border-cart-line bg-cart-bg-elev/35"><div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-16 sm:px-8 md:grid-cols-3"><Feature title="Describe lo que necesitas" text="Pide un borrador, una estructura de entradas o un resumen de ventas con lenguaje natural." /><Feature title="Revisa antes de publicar" text="El MCP prepara el trabajo; tú mantienes el control y decides cuándo publicar." /><Feature title="Acceso limitado a tu organización" text="Con OAuth, cada conexión queda autorizada para la organización que elijas." /></div></section><section className="mx-auto max-w-[840px] px-5 py-16 sm:px-8 sm:py-24"><p className="text-sm font-semibold uppercase tracking-[.15em] text-cart-accent">Empieza en minutos</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em] text-cart-ink sm:text-5xl">Conéctalo y empieza a pedir.</h2><ol className="mt-9 space-y-6 text-[17px] leading-8 text-cart-ink-2"><li><b className="text-cart-ink">01 · Abre Pasape MCP.</b> Conéctate con tu cuenta de Pasape y autoriza la organización correcta.</li><li><b className="text-cart-ink">02 · Usa la URL de conexión.</b><code className="ml-2 rounded-lg bg-cart-bg-elev px-2 py-1 text-sm text-cart-ink">https://pasape.lat/api/mcp</code></li><li><b className="text-cart-ink">03 · Empieza con un borrador.</b> Describe el evento y pídele que lo deje listo para tu revisión.</li></ol></section></div></BlogChrome>;
}

// Sin el tile de icono con la estrella de cuatro puntas: ese glifo se lee como
// "hecho por IA" y el cuadrado de color al 10 % era relleno decorativo. Tres
// columnas separadas por hairline, que es la regla de la casa (DESIGN.md).
function Feature({ title, text }: { title: string; text: string }) { return <div className="border-t border-cart-line pt-5"><h2 className="text-xl font-semibold tracking-[-.025em] text-cart-ink">{title}</h2><p className="mt-2 leading-7 text-cart-ink-2">{text}</p></div>; }

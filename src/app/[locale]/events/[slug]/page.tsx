import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { makeQueryClient } from "@/lib/_shared/query-client-config";
import { serverApiGet } from "@/lib/_shared/server-api";
import type { MeResponse } from "@/lib/identity/hooks/useCurrentUser";
import { IdentityController } from "@/server/identity/controllers/rest/IdentityController";
import type { Event, Promo, TicketType } from "@/server/events/domain/Event";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, eventJsonLd } from "@/lib/seo/jsonld";
import { CATEGORY_BY_ID } from "@/app/[locale]/_home/categories";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_LOCALE,
  SITE_NAME,
  SITE_URL,
  SUPPORTED_LOCALES,
  absoluteUrl,
  brandedTitle,
  localePath,
} from "@/lib/seo/site";
import { EventDetailClient } from "./EventDetailClient";

type EventDetailResponse = { event: Event; ticketTypes: TicketType[]; promos: Promo[] };

type Params = Promise<{ slug: string; locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const resolvedLocale = SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])
    ? locale
    : DEFAULT_LOCALE;

  try {
    const { event } = await serverApiGet<EventDetailResponse>(`/api/events/${slug}`);
    const fullTitle = brandedTitle(event.title);
    const description =
      event.description?.trim() ||
      `Compra entradas para ${event.title} en ${SITE_NAME}. Tickets digitales con QR al instante.`;
    const canonicalPath = localePath(resolvedLocale, `/events/${event.slug}`);
    const imagePath = localePath(resolvedLocale, `/events/${event.slug}/opengraph-image`);
    const url = absoluteUrl(canonicalPath);

    return {
      title: event.title,
      description,
      alternates: {
        canonical: canonicalPath,
        languages: {
          "es-PE": localePath("es", `/events/${event.slug}`),
          en: localePath("en", `/events/${event.slug}`),
        },
      },
      openGraph: {
        type: "website",
        url,
        siteName: SITE_NAME,
        title: fullTitle,
        description,
        locale: resolvedLocale === "en" ? "en_US" : "es_PE",
        images: [
          {
            url: absoluteUrl(imagePath),
            width: 1200,
            height: 630,
            alt: event.title,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: fullTitle,
        description,
        images: [absoluteUrl(imagePath)],
      },
    };
  } catch {
    const canonicalPath = localePath(resolvedLocale, `/events/${slug}`);
    const fallbackTitle = brandedTitle("Evento");
    return {
      title: "Evento",
      description: DEFAULT_DESCRIPTION,
      alternates: { canonical: canonicalPath },
      openGraph: {
        type: "website",
        url: new URL(canonicalPath, SITE_URL).toString(),
        title: fallbackTitle,
        description: DEFAULT_DESCRIPTION,
      },
    };
  }
}

// Comprar SIEMPRE requiere internet (pago), así que no hay ganancia en cargar
// esta página offline-first — a diferencia de home/wallet, acá conviene
// prefetchear en el server: el flyer y su paleta llegan resueltos en el
// primer HTML en vez de pintar negro plano hasta que el cliente haga fetch.
//
// También prefetcheamos la sesión — pero llamando directo a `IdentityController.me()`
// (misma función que usa la ruta /api/identity/me), NO por fetch HTTP a nuestra
// propia API: ya estamos en el servidor, con la cookie de Supabase disponible
// en este mismo proceso (`getAuthContext()`), así que ida-y-vuelta por HTTP
// sería puro overhead. Si hay sesión, el header llega YA autenticado en el
// primer HTML (sin el parpadeo "Ingresar" → avatar). El cache de IndexedDB
// del cliente (offline) sigue siendo el fallback para cuando no hay cookie
// válida o la red falla — no lo reemplaza, solo evita depender de él acá.
export default async function EventDetailPage({
  params,
}: {
  params: Params;
}) {
  const { slug, locale } = await params;
  const resolvedLocale = SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])
    ? locale
    : DEFAULT_LOCALE;

  const qc = makeQueryClient();
  const [detail, meResult] = await Promise.all([
    serverApiGet<EventDetailResponse>(`/api/events/${slug}`),
    IdentityController.me(),
  ]);

  // Sesión resuelta una sola vez: siembra el cache (para useCurrentUser +
  // offline) Y se pasa como prop al header (primer render determinista, sin
  // mismatch por el cache persistido async). Array literal en setQueryData (no
  // el `currentUserKey` importado): referenciar el array module-level hace que
  // el serializador RSC lo mande por referencia y llegue como string al cliente
  // → "queryKey needs to be an Array". La tupla literal calza el queryHash.
  const me: MeResponse = meResult.ok ? meResult.value : null;
  qc.setQueryData(["identity", "me"], me);
  qc.setQueryData(["events", "detail", slug], detail);

  const initialUser = me?.user
    ? { fullName: me.user.fullName, avatarUrl: me.user.avatarUrl }
    : null;

  const category = detail.event.category;
  const breadcrumbItems = [
    { name: "Inicio", path: "/" },
    { name: "Eventos", path: "/eventos" },
    ...(category
      ? [{ name: CATEGORY_BY_ID[category].label, path: `/eventos/${category}` }]
      : []),
    { name: detail.event.title, path: `/events/${detail.event.slug}` },
  ];

  return (
    <>
      <JsonLd
        data={[
          eventJsonLd(detail.event, detail.ticketTypes, resolvedLocale),
          breadcrumbJsonLd(breadcrumbItems, resolvedLocale),
        ]}
      />
      <HydrationBoundary state={dehydrate(qc)}>
        <EventDetailClient slug={slug} initialUser={initialUser} />
      </HydrationBoundary>
    </>
  );
}

import type { Event, TicketType } from "@/server/events/domain/Event";
import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  localePath,
} from "./site";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icons/logo-icon-min-512.png"),
    description: DEFAULT_DESCRIPTION,
    areaServed: {
      "@type": "Country",
      name: "Perú",
    },
    sameAs: [SITE_URL],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: ["es-PE", "en"],
    description: DEFAULT_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/es/events?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

function eventStatusUrl(status: Event["status"]): string {
  switch (status) {
    case "published":
      return "https://schema.org/EventScheduled";
    case "closed":
      return "https://schema.org/EventCompleted";
    case "cancelled":
      return "https://schema.org/EventCancelled";
    default:
      return "https://schema.org/EventScheduled";
  }
}

export function eventJsonLd(
  event: Event,
  ticketTypes: TicketType[],
  locale = "es",
): Record<string, unknown> {
  const url = absoluteUrl(localePath(locale, `/events/${event.slug}`));
  const prices = ticketTypes
    .map((tt) => tt.buyerPriceCents)
    .filter((cents) => cents >= 0);
  const minPriceCents = prices.length > 0 ? Math.min(...prices) : null;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description ?? DEFAULT_DESCRIPTION,
    startDate: event.startsAt,
    eventStatus: eventStatusUrl(event.status),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
    image: event.coverUrl ? [event.coverUrl] : [absoluteUrl("/opengraph-image")],
    organizer: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  if (event.endsAt) jsonLd.endDate = event.endsAt;
  if (event.category) jsonLd.eventType = event.category;

  if (event.venue) {
    jsonLd.location = {
      "@type": "Place",
      name: event.venue,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lima",
        addressCountry: "PE",
      },
    };
  }

  if (minPriceCents !== null) {
    jsonLd.offers = {
      "@type": "AggregateOffer",
      url,
      lowPrice: (minPriceCents / 100).toFixed(2),
      priceCurrency: event.currency || "PEN",
      availability:
        event.status === "published"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
    };
  }

  return jsonLd;
}

import type { EventCategory } from "@/server/events/domain/Event";

export type EventosLandingSlug = "conciertos" | "fiestas" | "comedia" | "festivales";

export type EventosLandingPage = {
  slug: EventosLandingSlug;
  category: EventCategory;
  title: string;
  h1: string;
  description: string;
};

export const EVENTOS_HUB = {
  path: "/eventos",
  title: "Eventos en Perú",
  h1: "Eventos en Perú",
  description:
    "Descubre conciertos, fiestas, festivales, comedia y más. Compra entradas digitales con QR en Pasape.",
} as const;

export const EVENTOS_LIMA = {
  path: "/eventos/lima",
  title: "Eventos en Lima",
  h1: "Eventos en Lima",
  description:
    "Compra entradas para los mejores eventos en Lima: conciertos, fiestas, festivales y experiencias.",
} as const;

export const EVENTOS_LANDINGS: EventosLandingPage[] = [
  {
    slug: "conciertos",
    category: "conciertos",
    title: "Conciertos en Lima",
    h1: "Conciertos en Lima",
    description:
      "Compra entradas para conciertos en Lima y Perú. Artistas nacionales e internacionales con QR al instante.",
  },
  {
    slug: "fiestas",
    category: "fiestas",
    title: "Fiestas en Lima",
    h1: "Fiestas en Lima",
    description:
      "Entradas para fiestas, noches electrónicas y after office en Lima. Compra segura con Pasape.",
  },
  {
    slug: "comedia",
    category: "comedia",
    title: "Comedia en Lima",
    h1: "Comedia en Lima",
    description:
      "Stand-up, improvisación y shows de comedia en Lima. Compra tus entradas con Pasape.",
  },
  {
    slug: "festivales",
    category: "festivales",
    title: "Festivales en Lima",
    h1: "Festivales en Lima",
    description:
      "Festivales de música, cultura y experiencias en Perú. Entradas digitales con Pasape.",
  },
];

export const EVENTOS_LANDING_BY_SLUG: Record<EventosLandingSlug, EventosLandingPage> =
  Object.fromEntries(EVENTOS_LANDINGS.map((p) => [p.slug, p])) as Record<
    EventosLandingSlug,
    EventosLandingPage
  >;

export const AYUDA_PAGE = {
  path: "/ayuda",
  title: "Centro de ayuda",
  h1: "Centro de ayuda",
  description:
    "Preguntas frecuentes sobre compra de entradas, QR, reembolsos y organización de eventos en Pasape.",
} as const;

export const PRIVACIDAD_PAGE = {
  path: "/privacidad",
  title: "Política de Privacidad",
  h1: "Política de Privacidad",
  description:
    "Cómo Pasape recopila, usa y protege tus datos personales al comprar entradas u organizar eventos.",
} as const;

export const TERMINOS_PAGE = {
  path: "/terminos",
  title: "Términos y Condiciones",
  h1: "Términos y Condiciones",
  description:
    "Condiciones de uso de Pasape para compradores, asistentes y organizadores de eventos.",
} as const;

export const SITEMAP_STATIC_PATHS = [
  "/",
  "/eventos/lima",
  ...EVENTOS_LANDINGS.map((p) => `/eventos/${p.slug}`),
  "/organizadores",
  "/ayuda",
  "/reclamos",
  "/privacidad",
  "/terminos",
] as const;

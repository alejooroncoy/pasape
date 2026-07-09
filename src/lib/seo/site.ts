export const SITE_URL = "https://pasape.lat";
export const SITE_NAME = "Pasape";
export const DEFAULT_LOCALE = "es";
export const SUPPORTED_LOCALES = ["es", "en"] as const;

export const DEFAULT_DESCRIPTION =
  "Compra entradas para conciertos, festivales, fiestas y experiencias en Perú con Pasape.";

/** Título corto de home; el layout y buildPageMetadata agregan `| Pasape`. */
export const HOME_TITLE = "Compra entradas para eventos en Perú";

export function pageTitle(input: string): string {
  const suffix = ` | ${SITE_NAME}`;
  let base = input.trim();
  if (base.endsWith(suffix)) base = base.slice(0, -suffix.length);
  if (base.startsWith(`${SITE_NAME} | `)) base = base.slice(`${SITE_NAME} | `.length);
  return base;
}

/** Formato canónico: `<página> | Pasape` */
export function brandedTitle(input: string): string {
  return `${pageTitle(input)} | ${SITE_NAME}`;
}

export const DEFAULT_OG_IMAGE = "/opengraph-image";

/** Perfiles públicos de marca — actualizar cuando existan las cuentas. */
export const SOCIAL_PROFILES = {
  instagram: "https://instagram.com/pasape",
  facebook: "https://facebook.com/pasape",
  tiktok: "https://tiktok.com/@pasape",
  linkedin: "https://linkedin.com/company/pasape",
  x: "https://x.com/pasape",
  youtube: "https://youtube.com/@pasape",
} as const;

export const SOCIAL_SAME_AS = Object.values(SOCIAL_PROFILES);

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, SITE_URL).toString();
}

export function localePath(locale: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized === "/" ? "" : normalized}`;
}

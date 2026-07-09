export const SITE_URL = "https://pasape.lat";
export const SITE_NAME = "Pasape";
export const DEFAULT_LOCALE = "es";
export const SUPPORTED_LOCALES = ["es", "en"] as const;

export const DEFAULT_DESCRIPTION =
  "Compra entradas para conciertos, festivales, fiestas y experiencias en Perú con Pasape.";

export const HOME_TITLE = "Pasape | Compra entradas para eventos en Perú";

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

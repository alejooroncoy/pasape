export const SITE_URL = "https://pasape.lat";
export const SITE_NAME = "Pasape";
export const DEFAULT_LOCALE = "es";
export const SUPPORTED_LOCALES = ["es", "en"] as const;

export const DEFAULT_DESCRIPTION =
  "Tu pase a los eventos que valen la pena en Lima. Entradas digitales con QR, combos y promotores.";

export const DEFAULT_OG_IMAGE = "/opengraph-image";

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, SITE_URL).toString();
}

export function localePath(locale: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized === "/" ? "" : normalized}`;
}

// Parsers puros para URLs de venue. Cero red — para que sean testeables.
//
// Soportamos:
//   - Apple Maps:  maps.apple.com  (?q=, ?name=, ?ll=, ?coordinate=, ?address=)
//   - Google Maps: google.com/maps/place/...   (parsea !3d!4d, og:title, title)
//   - Google Maps short: maps.app.goo.gl, goo.gl/maps  → necesitan redirect (no acá)

export type VenueParsed = {
  name: string | null;
  lat: number | null;
  lng: number | null;
  source: "google" | "apple";
};

const decodeName = (raw: string): string => {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " ")).trim();
  } catch {
    return raw.replace(/\+/g, " ").trim();
  }
};

const sanitize = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
};

// ---- Apple Maps ---------------------------------------------------------

const APPLE_HOSTS = new Set(["maps.apple.com", "beta.maps.apple.com"]);

export const isAppleMapsUrl = (url: URL): boolean => APPLE_HOSTS.has(url.hostname);

export const parseAppleMapsUrl = (url: URL): VenueParsed => {
  const p = url.searchParams;

  // Name: q | name | address (en ese orden de preferencia)
  const name =
    sanitize(p.get("q")) ??
    sanitize(p.get("name")) ??
    sanitize(p.get("address")) ??
    null;

  // Coords: ll=lat,lng | coordinate=lat,lng | sll=lat,lng | center=lat,lng
  const coordsRaw =
    p.get("ll") ?? p.get("coordinate") ?? p.get("sll") ?? p.get("center") ?? null;

  let lat: number | null = null;
  let lng: number | null = null;
  if (coordsRaw) {
    const m = coordsRaw.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
    if (m) {
      lat = Number(m[1]);
      lng = Number(m[2]);
    }
  }

  return { name, lat, lng, source: "apple" };
};

// ---- Google Maps URL parser (sobre la URL larga ya resuelta) -----------

const GOOGLE_MAPS_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "google.com.pe",
  "www.google.com.pe",
]);

export const isGoogleMapsUrl = (url: URL): boolean =>
  GOOGLE_MAPS_HOSTS.has(url.hostname) && url.pathname.startsWith("/maps");

export const isGoogleMapsShortUrl = (url: URL): boolean =>
  url.hostname === "maps.app.goo.gl" ||
  (url.hostname === "goo.gl" && url.pathname.startsWith("/maps"));

/** Parsea coords del patrón !3d{lat}!4d{lng} que Google incrusta en URLs largas. */
export const extractGoogleCoordsFromUrl = (
  url: URL,
): { lat: number; lng: number } | null => {
  const m = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { lat: Number(m[1]), lng: Number(m[2]) };
};

/** Parsea el nombre del path /place/{name}/. */
export const extractGoogleNameFromUrl = (url: URL): string | null => {
  const m = url.pathname.match(/\/place\/([^/]+)/);
  if (!m) return null;
  return sanitize(decodeName(m[1]!));
};

/** Combina URL + HTML del page para sacar nombre y coords. */
export const parseGoogleMapsLongUrl = (
  url: URL,
  html: string | null,
): VenueParsed => {
  // Tres fuentes para nombre, en orden de confiabilidad:
  //   1) og:title del HTML (más estable)
  //   2) <title> tag (acepta "Sala Reverb - Google Maps")
  //   3) /place/{name}/ del path (último recurso)
  const ogTitle = html ? extractMetaContent(html, "og:title") : null;
  const titleTag = html ? extractTitleTag(html) : null;
  const pathName = extractGoogleNameFromUrl(url);

  const name =
    sanitize(ogTitle) ??
    sanitize(titleTag) ??
    sanitize(pathName) ??
    null;

  // Coords: !3d!4d del URL (preferido), o center=lat,lng del og:image
  let lat: number | null = null;
  let lng: number | null = null;
  const fromUrl = extractGoogleCoordsFromUrl(url);
  if (fromUrl) {
    lat = fromUrl.lat;
    lng = fromUrl.lng;
  } else if (html) {
    const ogImage = extractMetaContent(html, "og:image");
    if (ogImage) {
      const u = safeUrl(ogImage);
      const c = u?.searchParams.get("center");
      if (c) {
        const m = c.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
        if (m) {
          lat = Number(m[1]);
          lng = Number(m[2]);
        }
      }
    }
  }

  return { name, lat, lng, source: "google" };
};

// ---- Helpers de extracción HTML (regex; suficiente para meta tags) -----

const safeUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

export const extractMetaContent = (html: string, property: string): string | null => {
  // Acepta property="X" o name="X", content antes o después.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m?.[1]) return decodeHtmlEntities(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2?.[1] ? decodeHtmlEntities(m2[1]) : null;
};

export const extractTitleTag = (html: string): string | null => {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m?.[1]) return null;
  const decoded = decodeHtmlEntities(m[1]).trim();
  // Google Maps title termina en " - Google Maps". Lo quitamos.
  return decoded.replace(/\s*[-·•|]\s*Google\s*Maps\s*$/i, "").trim();
};

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

const decodeHtmlEntities = (s: string): string =>
  s.replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m);

// ---- Entrada principal para parsing directo (sin red) ------------------

/** Detecta tipo de URL y aplica el parser correspondiente. Si no la reconoce, null. */
export const tryParseDirectVenueUrl = (raw: string): VenueParsed | null => {
  const url = safeUrl(raw);
  if (!url) return null;
  if (isAppleMapsUrl(url)) return parseAppleMapsUrl(url);
  if (isGoogleMapsUrl(url)) return parseGoogleMapsLongUrl(url, null);
  return null;
};

export const looksLikeMapsUrl = (raw: string): boolean => {
  const url = safeUrl(raw.trim());
  if (!url) return false;
  return isAppleMapsUrl(url) || isGoogleMapsUrl(url) || isGoogleMapsShortUrl(url);
};

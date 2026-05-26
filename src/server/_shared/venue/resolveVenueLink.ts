// Resuelve un URL de Maps (corto o largo, Apple o Google) a { name, lat, lng }.
// La parte de red está acá; la parte de parsing pura vive en parseVenueUrl.ts
// para testearla sin tocar internet.

import {
  isAppleMapsUrl,
  isGoogleMapsUrl,
  isGoogleMapsShortUrl,
  parseAppleMapsUrl,
  parseGoogleMapsLongUrl,
  type VenueParsed,
} from "./parseVenueUrl";

const FETCH_TIMEOUT_MS = 8_000;
// Crawler UA: Google sirve la versión SSR con redirect 302 a la URL larga.
// Con UA de browser real devuelve una interstitial JS-rendered que nunca
// redirige server-side. facebookexternalhit es universalmente aceptado.
const USER_AGENT = "facebookexternalhit/1.1";
const MAX_HTML_BYTES = 256 * 1024; // 256KB es más que suficiente para meta tags

const safeUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, ...(init.headers as Record<string, string> | undefined) },
    });
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Sigue redirects manualmente hasta MAX_REDIRECTS pasos. Necesario porque
 * Node fetch con `redirect: "follow"` no actualiza `res.url` confiablemente
 * cuando salta cross-origin (ej: maps.app.goo.gl → www.google.com).
 * Devuelve { finalUrl, response } donde finalUrl es la URL absoluta final.
 */
const MAX_REDIRECTS = 5;
const followRedirects = async (
  startUrl: string,
): Promise<{ finalUrl: string; response: Response }> => {
  let current = startUrl;
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const res = await fetchWithTimeout(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      // Resolvemos relativo al actual por si Google manda una path relativa.
      current = new URL(loc, current).toString();
      continue;
    }
    return { finalUrl: current, response: res };
  }
  // Si agotamos los hops, retornamos lo último que intentamos.
  const res = await fetchWithTimeout(current, { redirect: "manual" });
  return { finalUrl: current, response: res };
};

const readLimitedText = async (res: Response, maxBytes: number): Promise<string> => {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (received >= maxBytes) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return out;
};

export type ResolveResult =
  | { ok: true; data: VenueParsed & { resolvedUrl: string } }
  | { ok: false; reason: "invalid_url" | "unsupported" | "fetch_failed" | "no_data" };

export const resolveVenueLink = async (raw: string): Promise<ResolveResult> => {
  const url = safeUrl(raw.trim());
  if (!url) return { ok: false, reason: "invalid_url" };

  // Apple Maps: parser directo, cero red.
  if (isAppleMapsUrl(url)) {
    const parsed = parseAppleMapsUrl(url);
    if (!parsed.name && parsed.lat === null) return { ok: false, reason: "no_data" };
    return { ok: true, data: { ...parsed, resolvedUrl: url.toString() } };
  }

  // Google Maps (largo o corto): seguimos redirects manualmente para conseguir
  // la URL final con /place/{name}/ y !3d!4d. El HTML de Google Maps es JS-rendered
  // así que og:tags no están en el response inicial — confiamos en la URL.
  if (isGoogleMapsUrl(url) || isGoogleMapsShortUrl(url)) {
    try {
      const { finalUrl, response } = await followRedirects(url.toString());
      const finalParsed = safeUrl(finalUrl) ?? url;

      if (!isGoogleMapsUrl(finalParsed)) {
        // El redirect no llevó a google.com/maps (ej: link expirado o /search).
        return { ok: false, reason: "no_data" };
      }

      // El HTML está casi vacío en Google Maps, pero igual lo leemos por si
      // algún día devuelven og:tags en SSR.
      const html = response.ok ? await readLimitedText(response, MAX_HTML_BYTES) : null;
      const parsed = parseGoogleMapsLongUrl(finalParsed, html);
      if (!parsed.name && parsed.lat === null) return { ok: false, reason: "no_data" };
      return { ok: true, data: { ...parsed, resolvedUrl: finalParsed.toString() } };
    } catch {
      return { ok: false, reason: "fetch_failed" };
    }
  }

  return { ok: false, reason: "unsupported" };
};

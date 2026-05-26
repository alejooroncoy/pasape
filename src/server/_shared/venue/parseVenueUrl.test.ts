import { describe, it, expect } from "vitest";
import {
  isAppleMapsUrl,
  isGoogleMapsUrl,
  isGoogleMapsShortUrl,
  looksLikeMapsUrl,
  parseAppleMapsUrl,
  parseGoogleMapsLongUrl,
  extractGoogleCoordsFromUrl,
  extractGoogleNameFromUrl,
  extractMetaContent,
  extractTitleTag,
  tryParseDirectVenueUrl,
} from "./parseVenueUrl";

const u = (s: string): URL => new URL(s);

describe("isAppleMapsUrl / isGoogleMapsUrl / isGoogleMapsShortUrl", () => {
  it("Apple Maps", () => {
    expect(isAppleMapsUrl(u("https://maps.apple.com/?q=Sala+Reverb"))).toBe(true);
    expect(isAppleMapsUrl(u("https://beta.maps.apple.com/?q=X"))).toBe(true);
  });
  it("Google Maps largo", () => {
    expect(isGoogleMapsUrl(u("https://www.google.com/maps/place/Sala+Reverb/"))).toBe(true);
    expect(isGoogleMapsUrl(u("https://maps.google.com/maps/place/Reverb"))).toBe(true);
    expect(isGoogleMapsUrl(u("https://google.com/search?q=X"))).toBe(false);
  });
  it("Google Maps short", () => {
    expect(isGoogleMapsShortUrl(u("https://maps.app.goo.gl/8JXjBgV3r9hrE78U7"))).toBe(true);
    expect(isGoogleMapsShortUrl(u("https://goo.gl/maps/abc"))).toBe(true);
    expect(isGoogleMapsShortUrl(u("https://goo.gl/other"))).toBe(false);
  });
  it("looksLikeMapsUrl agrupa todos", () => {
    expect(looksLikeMapsUrl("https://maps.app.goo.gl/X")).toBe(true);
    expect(looksLikeMapsUrl("https://maps.apple.com/?q=X")).toBe(true);
    expect(looksLikeMapsUrl("Barranco, Lima")).toBe(false);
    expect(looksLikeMapsUrl("")).toBe(false);
    expect(looksLikeMapsUrl("not a url at all")).toBe(false);
  });
});

describe("parseAppleMapsUrl", () => {
  it("?q=Name&ll=lat,lng", () => {
    const p = parseAppleMapsUrl(u("https://maps.apple.com/?q=Sala+Reverb&ll=-12.143,-77.022"));
    expect(p).toEqual({ name: "Sala Reverb", lat: -12.143, lng: -77.022, source: "apple" });
  });
  it("?name=X (sin coords)", () => {
    const p = parseAppleMapsUrl(u("https://maps.apple.com/?name=Hacienda%20Punta%20Hermosa"));
    expect(p.name).toBe("Hacienda Punta Hermosa");
    expect(p.lat).toBeNull();
    expect(p.lng).toBeNull();
  });
  it("?coordinate=lat,lng (sin name)", () => {
    const p = parseAppleMapsUrl(u("https://maps.apple.com/place?coordinate=-12,-77"));
    expect(p.lat).toBe(-12);
    expect(p.lng).toBe(-77);
    expect(p.name).toBeNull();
  });
  it("?address fallback para name", () => {
    const p = parseAppleMapsUrl(u("https://maps.apple.com/?address=Av+Larco+123"));
    expect(p.name).toBe("Av Larco 123");
  });
});

describe("extractGoogleCoordsFromUrl / extractGoogleNameFromUrl", () => {
  it("!3d!4d", () => {
    const c = extractGoogleCoordsFromUrl(
      u("https://www.google.com/maps/place/X/@-12.143,-77.022,17z/data=!4m6!3m5!1s0x:0x!8m2!3d-12.143!4d-77.022"),
    );
    expect(c).toEqual({ lat: -12.143, lng: -77.022 });
  });
  it("sin !3d!4d → null", () => {
    expect(extractGoogleCoordsFromUrl(u("https://www.google.com/maps/place/X/"))).toBeNull();
  });
  it("name del path", () => {
    const n = extractGoogleNameFromUrl(u("https://www.google.com/maps/place/Sala+Reverb/data=!"));
    expect(n).toBe("Sala Reverb");
  });
  it("name URL-encoded con tildes", () => {
    const n = extractGoogleNameFromUrl(u("https://www.google.com/maps/place/Caf%C3%A9%20Sof%C3%ADa/"));
    expect(n).toBe("Café Sofía");
  });
});

describe("extractMetaContent / extractTitleTag", () => {
  it("og:title con property primero", () => {
    const html = `<meta property="og:title" content="Sala Reverb">`;
    expect(extractMetaContent(html, "og:title")).toBe("Sala Reverb");
  });
  it("og:title con content primero (orden inverso)", () => {
    const html = `<meta content="Sala Reverb" property="og:title">`;
    expect(extractMetaContent(html, "og:title")).toBe("Sala Reverb");
  });
  it("title con sufijo - Google Maps", () => {
    expect(extractTitleTag("<title>Sala Reverb - Google Maps</title>")).toBe("Sala Reverb");
  });
  it("title con · Google Maps", () => {
    expect(extractTitleTag("<title>Reverb · Google Maps</title>")).toBe("Reverb");
  });
  it("entities decodificados", () => {
    expect(extractTitleTag("<title>Caf&#39;e &amp; Bar - Google Maps</title>")).toBe("Caf'e & Bar");
  });
  it("título vacío", () => {
    expect(extractTitleTag("<title></title>")).toBeNull();
  });
});

describe("parseGoogleMapsLongUrl (sin HTML)", () => {
  it("solo URL — usa !3d!4d + /place/", () => {
    const p = parseGoogleMapsLongUrl(
      u("https://www.google.com/maps/place/Sala+Reverb/@-12.1,-77.0,17z/data=!3d-12.143!4d-77.022"),
      null,
    );
    expect(p).toEqual({ name: "Sala Reverb", lat: -12.143, lng: -77.022, source: "google" });
  });
  it("URL sin coords ni path → todo null", () => {
    const p = parseGoogleMapsLongUrl(u("https://www.google.com/maps"), null);
    expect(p.name).toBeNull();
    expect(p.lat).toBeNull();
  });
});

describe("parseGoogleMapsLongUrl (con HTML)", () => {
  it("og:title gana sobre /place/", () => {
    const html = `<meta property="og:title" content="Real Name">`;
    const p = parseGoogleMapsLongUrl(
      u("https://www.google.com/maps/place/Wrong+Name/data=!3d1!4d2"),
      html,
    );
    expect(p.name).toBe("Real Name");
    expect(p.lat).toBe(1);
  });
  it("fallback a <title> si no hay og:title", () => {
    const html = `<title>Title Name - Google Maps</title>`;
    const p = parseGoogleMapsLongUrl(u("https://www.google.com/maps/place/Z/"), html);
    expect(p.name).toBe("Title Name");
  });
  it("coords del og:image center=", () => {
    const html = `<meta property="og:image" content="https://maps.googleapis.com/staticmap?center=-12.5,-77.5&zoom=15">`;
    const p = parseGoogleMapsLongUrl(u("https://www.google.com/maps/place/X/"), html);
    expect(p.lat).toBe(-12.5);
    expect(p.lng).toBe(-77.5);
  });
});

describe("tryParseDirectVenueUrl", () => {
  it("Apple Maps", () => {
    const p = tryParseDirectVenueUrl("https://maps.apple.com/?q=X&ll=1,2");
    expect(p?.source).toBe("apple");
    expect(p?.name).toBe("X");
  });
  it("Google Maps largo (sin HTML, solo URL)", () => {
    const p = tryParseDirectVenueUrl("https://www.google.com/maps/place/X/data=!3d1!4d2");
    expect(p?.source).toBe("google");
    expect(p?.lat).toBe(1);
  });
  it("URL inválida → null", () => {
    expect(tryParseDirectVenueUrl("not a url")).toBeNull();
  });
  it("Texto plano → null", () => {
    expect(tryParseDirectVenueUrl("Barranco, Lima")).toBeNull();
  });
  it("URL random no maps → null", () => {
    expect(tryParseDirectVenueUrl("https://example.com/page")).toBeNull();
  });
});

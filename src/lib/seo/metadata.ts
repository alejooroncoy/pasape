import type { Metadata } from "next";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  brandedTitle,
  localePath,
  pageTitle,
} from "./site";

type PageMetaInput = {
  title: string;
  description?: string;
  locale: string;
  path: string;
  ogType?: "website" | "article";
  keywords?: string[];
};

export function buildPageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  locale,
  path,
  ogType = "website",
  keywords,
}: PageMetaInput): Metadata {
  const canonicalPath = localePath(locale, path);
  const url = absoluteUrl(canonicalPath);
  const ogImage = absoluteUrl(DEFAULT_OG_IMAGE);
  const shortTitle = pageTitle(title);
  const fullTitle = brandedTitle(shortTitle);

  return {
    title: shortTitle,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: {
      canonical: canonicalPath,
      languages: {
        "es-PE": localePath("es", path),
        en: localePath("en", path),
      },
    },
    openGraph: {
      type: ogType,
      url,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      locale: locale === "en" ? "en_US" : "es_PE",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
  };
}

/** Rutas autenticadas / checkout — no deben competir con páginas públicas en el índice. */
export const NOINDEX_METADATA: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

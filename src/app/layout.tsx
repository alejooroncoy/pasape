import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";
import { AnalyticsScripts } from "@/components/analytics/AnalyticsScripts";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  HOME_TITLE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  brandedTitle,
} from "@/lib/seo/site";

const HOME_FULL_TITLE = brandedTitle(HOME_TITLE);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: HOME_FULL_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "entradas eventos lima",
    "eventos peru",
    "comprar entradas",
    "tickets digitales",
    "pasape",
    "conciertos lima",
    "festivales peru",
  ],
  manifest: "/manifest.json",
  applicationName: SITE_NAME,
  category: "events",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/logo-icon-min-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/icons/logo-dark-square-180.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: HOME_FULL_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE),
        width: 1200,
        height: 630,
        alt: HOME_FULL_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_FULL_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7C3AED",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`h-full ${fontVariables}`} data-scroll-behavior="smooth">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pasape" />
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM site summary" />
        <AnalyticsScripts />
      </head>
      <body className="min-h-full">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        {children}
      </body>
    </html>
  );
}

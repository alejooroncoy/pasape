import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://pasa.pe";
const DESCRIPTION =
  "Tu pase a los eventos que valen la pena en Lima. Entradas digitales con QR, combos y promotores.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pasape — Entradas para eventos en Lima",
    template: "%s · Pasape",
  },
  description: DESCRIPTION,
  manifest: "/manifest.json",
  applicationName: "Pasape",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pasape",
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: SITE_URL,
    siteName: "Pasape",
    title: "Pasape — Entradas para eventos en Lima",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Pasape — Entradas para eventos en Lima",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#7C3AED",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@200,300,400,500,600,700&display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pasape" />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

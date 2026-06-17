import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/.*\/api\/scanning/,
      handler: "NetworkOnly",
    },
    {
      urlPattern: /^https?:\/\/.*\/api\/events\/.*\/scan-cache/,
      handler: "NetworkFirst",
      options: { cacheName: "scan-cache", networkTimeoutSeconds: 5 },
    },
    {
      urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: { cacheName: "pages", networkTimeoutSeconds: 3 },
    },
    {
      urlPattern: /\.(?:js|css|woff2?|png|jpg|svg|ico)$/,
      handler: "StaleWhileRevalidate",
      options: { cacheName: "assets" },
    },
  ],
});

const nextConfig: NextConfig = {
  // Permite que el dev server acepte requests proxied desde ngrok (HTTPS).
  // Necesario para probar Mercado Pago localmente: MP rechaza CORS desde
  // localhost HTTP en /v1/card_tokens. Con ngrok obtenemos HTTPS válido.
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "*.ngrok.app",
  ],
  // La ruta opengraph-image lee el logo desde public/ con fs en runtime; el
  // tracer no detecta esa lectura dinámica, así que forzamos su inclusión en
  // el bundle de la función (si no, en prod la OG saldría sin logo).
  outputFileTracingIncludes: {
    "/opengraph-image": ["./public/icons/logo-icon-min-512.png"],
    "/twitter-image": ["./public/icons/logo-icon-min-512.png"],
  },
  // Oculta el indicador flotante de Next en dev (el círculo "N" abajo-izquierda
  // que se confundía con la UI al emular en celular).
  devIndicators: false,
};

// Sentry envuelve por fuera de PWA/intl. El authToken se lee de
// .env.sentry-build-plugin (gitignored); sin él, el plugin solo omite la subida
// de sourcemaps con un warning (no rompe el build).
export default withSentryConfig(withPWA(withNextIntl(nextConfig)), {
  org: "pasape",
  project: "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Sube un set más amplio de archivos cliente para mejores stack traces.
  widenClientFileUpload: true,
  // Proxy para que los eventos no los bloqueen ad-blockers (excluido en proxy.ts).
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
  telemetry: false,
});

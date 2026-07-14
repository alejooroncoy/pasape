import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Service worker: NO usamos plugins de PWA atados al bundler (next-pwa/@serwist
// son de webpack y no corren bajo Turbopack, el build por defecto de Next 16).
// El SW vive escrito a mano en public/sw.js y se registra desde
// ServiceWorkerRegister. Cachea en runtime (shell + assets) → la wallet carga
// offline; los datos los aporta la persistencia de React Query.

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/eventos", destination: "/es/eventos", permanent: true },
      { source: "/eventos/:path*", destination: "/es/eventos/:path*", permanent: true },
      { source: "/ayuda", destination: "/es/ayuda", permanent: true },
      { source: "/evento/:slug", destination: "/es/events/:slug", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
  // Permite que el dev server acepte requests proxied desde ngrok (HTTPS).
  // Necesario para probar Mercado Pago localmente: MP rechaza CORS desde
  // localhost HTTP en /v1/card_tokens. Con ngrok obtenemos HTTPS válido.
  // También habilita la red local (192.168.*) para probar la app del
  // portero (Capacitor) contra el dev server desde el celular.
  allowedDevOrigins: [
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "*.ngrok.app",
    "192.168.*.*",
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
export default withSentryConfig(withNextIntl(nextConfig), {
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

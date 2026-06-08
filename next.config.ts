import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "next-pwa";

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
};

export default withPWA(withNextIntl(nextConfig));

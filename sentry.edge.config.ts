import * as Sentry from "@sentry/nextjs";

// Sentry en el runtime edge (proxy/middleware, edge routes). DSN por env var.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  sendDefaultPii: true,
  // Separa prod/preview/dev en Sentry (VERCEL_ENV: "production" | "preview" | "development").
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enableLogs: true,
});

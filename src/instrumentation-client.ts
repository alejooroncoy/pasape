import * as Sentry from "@sentry/nextjs";

// Inicialización de Sentry en el cliente (browser). El DSN público se inyecta
// por env var; vacío → `enabled: false` deja a Sentry como no-op.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  // Replays desactivados por defecto (privacidad + costo). Se activan luego si hace falta.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

// Requerido por Next para instrumentar las transiciones de navegación del App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

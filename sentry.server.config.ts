import * as Sentry from "@sentry/nextjs";

// Inicialización de Sentry para el runtime de Node (server). El DSN se inyecta
// por env var — mientras esté vacío, `enabled: false` deja a Sentry como no-op
// (sin red, sin overhead), así el repo arranca sin configurar nada.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NODE_ENV,
  // Trazas: bajamos el sampling en prod para no encarecer. Ajustable luego.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
});

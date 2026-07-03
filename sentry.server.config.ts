import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/sentryScrub";

// Sentry en el runtime Node (server). DSN privado por env var; vacío → no-op.
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  // PII apagado: sin IP/cookies/headers de auth. Esta es una app de pagos —
  // enviar datos de tarjeta/DNI a Sentry sería violación PCI y de privacidad.
  sendDefaultPii: false,
  // Separa prod/preview/dev en Sentry (VERCEL_ENV: "production" | "preview" | "development").
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // NO adjuntar variables locales: en handlers de /api/payments/* contendrían
  // card_number, security_code y DNI en claro dentro de los stack frames.
  includeLocalVariables: false,
  enableLogs: true,
  // Defensa en profundidad: redacta cualquier dato sensible que igual se cuele
  // por request body, extra o breadcrumbs antes de salir hacia Sentry.
  beforeSend: (event) => scrubSentryEvent(event),
});

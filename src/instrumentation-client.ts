import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/sentryScrub";

// Sentry en el cliente (browser). DSN público por env var; vacío → no-op.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  // No enviar desde local (`next dev`): consume la cuota de producción.
  enabled: !!dsn && process.env.NODE_ENV !== "development",
  // PII apagado: no enviar IP ni datos del navegador que identifiquen al usuario.
  sendDefaultPii: false,
  // Separa prod/preview/dev en Sentry. En el cliente solo hay vars NEXT_PUBLIC_*;
  // NEXT_PUBLIC_VERCEL_ENV la expone Vercel automáticamente si "Automatically expose
  // System Environment Variables" está activo en el proyecto (Settings → Environment
  // Variables). Si no está activo, esta var es undefined y cae a NODE_ENV.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  // 100% de trazas en dev, 10% en producción (costo).
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Session Replay: 10% de sesiones, 100% cuando hay error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  beforeSend: (event) => scrubSentryEvent(event),
  integrations: [Sentry.replayIntegration()],
});

// Requerido por Next para instrumentar las transiciones del App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

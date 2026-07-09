import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
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
  // Session Replay en el bundle inicial penaliza Lighthouse (~50 KiB + main thread).
  // Los errores siguen capturándose; el replay on-error se puede reactivar luego
  // con lazy import si hace falta en prod.
  integrations: [],
});

// Requerido por Next para instrumentar las transiciones del App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  // Session replay: enmascara todo input por defecto (DNI, teléfono, tarjeta
  // si algún campo escapa del iframe de Secure Fields de MP). Los QR de
  // entradas (sensibles: rotan cada 10s pero siguen siendo válidos en vivo)
  // se excluyen por completo vía la clase `ph-no-capture` en QrSquare.
  session_recording: {
    maskAllInputs: true,
  },
  // Recorder + surveys suman ~75 KiB en el critical path sin aportar al primer paint.
  disable_session_recording: true,
  disable_surveys: true,
});

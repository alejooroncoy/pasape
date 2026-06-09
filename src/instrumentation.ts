import * as Sentry from "@sentry/nextjs";

// Carga la config de Sentry según el runtime activo. Next ejecuta `register`
// una vez al arrancar cada runtime (node / edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Captura errores de request del App Router (Server Components, route handlers).
export const onRequestError = Sentry.captureRequestError;

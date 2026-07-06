import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Telemetría opcional cuando el autocomplete DNI pega el rate limit (10/min/IP).
 * UX sin cambios: el usuario sigue escribiendo el nombre a mano.
 *
 * Activar en prod: `DNI_LOOKUP_RATE_LIMIT_SENTRY_ENABLED=true`
 */
export const isDniLookupRateLimitSentryEnabled = (): boolean =>
  process.env.DNI_LOOKUP_RATE_LIMIT_SENTRY_ENABLED === "true";

export const reportDniLookupRateLimited = (): void => {
  if (!isDniLookupRateLimitSentryEnabled()) return;

  Sentry.captureMessage("dni_lookup_rate_limited", {
    level: "info",
    tags: {
      area: "identity",
      feature: "dni-lookup",
      kind: "rate_limited",
    },
  });
};

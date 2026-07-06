"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import posthog from "posthog-js";

// Error boundary raíz del App Router. Captura errores no manejados que escapan
// de los layouts y los reporta a Sentry (no-op si no hay DSN). Reemplaza la
// pantalla en blanco por un mensaje con opción de reintentar.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="grid min-h-dvh place-items-center bg-cart-bg px-6 text-center text-white">
        <div className="max-w-[360px]">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em]">
            Algo salió mal
          </h1>
          <p className="mt-2 text-[14px] text-cart-ink-2">
            Tuvimos un problema inesperado. Ya quedó registrado — intenta de nuevo.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-cart-accent px-6 text-[14px] font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}

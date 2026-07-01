import "server-only";
import * as Sentry from "@sentry/nextjs";

// Captura errores de Mercado Pago con su contexto completo. El string de error
// que devolvemos al front trunca el detalle (p.ej. "internal_error"); aquí
// guardamos la respuesta cruda de MP, el orderId y la etapa para poder
// diagnosticar en Sentry. No-op silencioso si no hay SENTRY_DSN.
export type MpErrorContext = {
  /** Etapa del flujo donde falló. */
  stage: "preference" | "payment";
  /** Método de pago, si aplica. */
  method?: "yape" | "card";
  orderId?: string;
  /** HTTP status de la respuesta de MP. */
  httpStatus?: number;
  /** Respuesta cruda de MP (mensaje, status_detail, cause, etc.). */
  mpResponse?: unknown;
};

export const reportMpError = (message: string, ctx: MpErrorContext): void => {
  // Siempre visible en logs (dev y prod), independiente de Sentry.
  console.error(`[mercadopago] ${ctx.stage} error: ${message}`, {
    orderId: ctx.orderId,
    method: ctx.method,
    httpStatus: ctx.httpStatus,
    mpResponse: ctx.mpResponse,
  });

  Sentry.captureException(
    new Error(`mercadopago_${ctx.stage}_failed: ${message}`),
    {
      tags: {
        area: "mercadopago",
        mp_stage: ctx.stage,
        ...(ctx.method ? { mp_method: ctx.method } : {}),
      },
      extra: {
        orderId: ctx.orderId,
        httpStatus: ctx.httpStatus,
        mpResponse: ctx.mpResponse,
      },
    },
  );
};

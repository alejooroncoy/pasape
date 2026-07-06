import posthog from "posthog-js";

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
});

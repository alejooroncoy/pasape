"use client";

import { C, FONT_DISPLAY } from "@/components/design";

// El escaneo es EXCLUSIVO de la app nativa del portero (offline-first, LAN
// entre celulares) — el navegador ya no deja canjear el código ni escanear.
// Esta pantalla solo aparece cuando alguien abre el link de puerta
// (`/scan?door=CODE`) o `/scan` sin sesión y no tiene la app instalada: le
// avisa que instale la app en vez de ofrecerle un onboarding/cámara web.
//
// `initialCode` llega del link compartido — se muestra para que lo tenga a
// mano al abrir la app instalada.

export function ScanOnboarding({ initialCode }: { initialCode?: string }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: C.bg,
        color: C.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: 10,
          }}
        >
          Instala la app del portero
        </div>
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.5 }}>
          Validar entradas se hace desde la app del portero (funciona sin
          internet). Pídele el instalador al organizador de tu evento.
        </div>

        {initialCode && (
          <div
            style={{
              marginTop: 24,
              padding: "12px 14px",
              borderRadius: 12,
              background: C.bg2,
              border: `1px solid ${C.line}`,
            }}
          >
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>
              Código del evento — tenlo a mano al abrir la app
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 3,
                color: C.purple,
              }}
            >
              {initialCode}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

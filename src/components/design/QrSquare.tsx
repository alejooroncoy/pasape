"use client";

import { useEffect, useRef } from "react";
import type QRCodeStyling from "qr-code-styling";

type Props = {
  code: string;
  size?: number;
  /** URL de imagen para el centro. Requiere errorCorrectionLevel H. */
  centerImage?: string;
  /** "H" para QR decorativos con logo, "M" para tickets (default, más rápido de escanear). */
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
};

export const QrSquare = ({ code, size = 220, centerImage, errorCorrectionLevel = "M" }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const firstRender = useRef(true);
  // Siempre el `code` más reciente: el import de qr-code-styling es asíncrono, así
  // que el `code` pudo cambiar (rota cada 10s) antes de que la lib cargue. La ref
  // se actualiza en un effect (no en render) para leerla desde el callback async.
  const latestCode = useRef(code);
  useEffect(() => {
    latestCode.current = code;
  });

  useEffect(() => {
    if (!ref.current) return;
    // qr-code-styling es una lib pesada (canvas/SVG). Cargarla dinámicamente aquí
    // — en vez de un import estático top-level — la saca del bundle inicial de todo
    // el flujo de tickets (el QR siempre se pinta en cliente tras montar).
    let cancelled = false;
    void import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      if (cancelled || !ref.current) return;

      const qr = new QRCodeStyling({
        width: size,
        height: size,
        data: latestCode.current,
        image: centerImage,
        qrOptions: { errorCorrectionLevel: centerImage ? "H" : errorCorrectionLevel },
        // Balance estética/lectura: módulos LEVEMENTE redondeados ("rounded") para
        // que se vea diseñado, pero los PATRONES DE ESQUINA (finder) CUADRADOS — son
        // los que el lector usa para ubicar/orientar el QR; redondearlos lo hace
        // lento/poco fiable. "extra-rounded" difumina demasiado los bordes. Negro
        // puro sobre blanco = contraste máximo.
        dotsOptions: { type: "rounded", color: "#000000" },
        cornersSquareOptions: { type: "square", color: "#000000" },
        cornersDotOptions: { type: "square", color: "#000000" },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: {
          crossOrigin: "anonymous",
          margin: 6,
          imageSize: 0.22,
        },
      });

      qr.append(ref.current);
      qrRef.current = qr;
    });

    return () => {
      cancelled = true;
      qrRef.current = null;
      if (ref.current) ref.current.innerHTML = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Primer render: el canvas ya se dibujó en el mount, no animar.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    // Crossfade al rotar — SIN blur ni scale: el QR debe estar nítido y completo
    // en todo momento (cada 10s rota; si lo desenfocábamos 420ms, un scan en ese
    // instante fallaba). Solo un fade de opacidad muy sutil.
    qrRef.current?.update({ data: code });
    el.animate(
      [{ opacity: 0.6 }, { opacity: 1 }],
      { duration: 160, easing: "ease-out" },
    );
  }, [code]);

  return (
    <div
      ref={ref}
      // ph-no-capture: excluye el QR del session replay de PostHog — es
      // válido en vivo (rota cada 10s pero sigue siendo una entrada real).
      className="ph-no-capture"
      style={{
        width: size,
        height: size,
        display: "inline-block",
        animation: "qr-fade-in 300ms ease-out both",
        borderRadius: 10,
        overflow: "hidden",
      }}
    />
  );
};

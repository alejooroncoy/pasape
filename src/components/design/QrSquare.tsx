"use client";

import { useEffect, useRef } from "react";
import QRCodeStyling from "qr-code-styling";

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

  useEffect(() => {
    if (!ref.current) return;

    const qr = new QRCodeStyling({
      width: size,
      height: size,
      data: code,
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

    return () => {
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

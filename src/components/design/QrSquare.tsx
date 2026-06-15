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
      dotsOptions: { type: "extra-rounded", color: "#000000" },
      cornersSquareOptions: { type: "extra-rounded", color: "#000000" },
      cornersDotOptions: { type: "dot", color: "#000000" },
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
    // Crossfade al rotar: el QR nuevo entra con un fade+scale suave. update() es
    // síncrono, así que animamos el contenedor para suavizar el cambio visual.
    qrRef.current?.update({ data: code });
    el.animate(
      [
        { opacity: 0.25, transform: "scale(0.94)", filter: "blur(2px)" },
        { opacity: 1, transform: "scale(1)", filter: "blur(0px)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
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

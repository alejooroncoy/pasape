"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

// QR real escaneable usando la lib `qrcode`. El `code` es el qr_code del ticket
// (string opaco firmado). Cuando implementemos rotation TOTP, el padre va a
// pasar un code distinto cada N segundos y este componente lo re-renderiza.

export const QrSquare = ({ code, size = 220 }: { code: string; size?: number }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    void QRCode.toCanvas(ref.current, code, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0A0A0F", light: "#ffffff" },
    });
  }, [code, size]);
  return <canvas ref={ref} width={size} height={size} style={{ display: "block" }} />;
};

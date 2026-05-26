import type { ReactNode } from "react";
import { C, FONT_BODY } from "./tokens";

type Props = { children: ReactNode; bg?: string };

// Antes era un mockup iPhone con bisel + status bar + home indicator.
// Ahora es solo el viewport pixel-perfect: la pantalla ocupa la ventana real,
// con el ancho de diseño (390px) en mobile y centrado.
export const Phone = ({ children, bg = C.bg }: Props) => (
  <div
    style={{
      width: "100%",
      maxWidth: 390,
      minHeight: "100dvh",
      background: bg,
      color: C.text,
      fontFamily: FONT_BODY,
      position: "relative",
      overflow: "hidden",
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
    }}
  >
    {children}
  </div>
);

"use client";

import type { InputHTMLAttributes } from "react";
import { focusOnDesktop } from "@/lib/_shared/focusOnDesktop";
import { C, FONT_BODY, FONT_DISPLAY, FONT_MONO } from "./tokens";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  mono?: boolean;
  active?: boolean;
  hint?: string;
};

// `autoFocus` se estrecha aparte: en móvil solo pone el cursor sin abrir el
// teclado (se siente como "doble tap"), así que lo convertimos en un enfoque
// solo-desktop vía focusOnDesktop en vez de pasarlo al input nativo.
export const Field = ({ label, mono, active, hint, style, autoFocus, ...input }: Props) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, color: C.dimmer, letterSpacing: "0.06em", marginBottom: 6 }}>{label.toUpperCase()}</div>
    <div
      style={{
        height: 52,
        borderRadius: 14,
        padding: "0 16px",
        background: active ? "rgba(124,58,237,0.10)" : "rgba(255,255,255,0.04)",
        boxShadow: active
          ? `0 0 0 1.5px ${C.purple} inset, 0 0 18px -8px rgba(124,58,237,0.3)`
          : `0 0 0 1px ${C.line} inset`,
        display: "flex",
        alignItems: "center",
      }}
    >
      <input
        {...input}
        ref={autoFocus ? focusOnDesktop : undefined}
        style={{
          flex: 1,
          border: 0,
          outline: "none",
          background: "transparent",
          color: C.text,
          fontFamily: mono ? FONT_MONO : FONT_DISPLAY,
          fontWeight: 700,
          fontSize: mono ? 15 : 16,
          padding: 0,
          ...style,
        }}
      />
    </div>
    {hint && (
      <div style={{ fontSize: 11, color: C.dimmer, marginTop: 6, fontFamily: FONT_BODY }}>{hint}</div>
    )}
  </div>
);

"use client";

import { C, FONT_MONO } from "./tokens";

type Props = {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
};

export const PhoneField = ({ value, onChange, autoFocus }: Props) => {
  const active = value.length > 0 || !!autoFocus;
  return (
    <div
      style={{
        height: 64,
        borderRadius: 18,
        padding: "0 18px",
        background: active ? "rgba(124,58,237,0.10)" : "rgba(255,255,255,0.04)",
        boxShadow: active
          ? `0 0 0 1.5px ${C.purple} inset, 0 0 24px -8px rgba(124,58,237,0.35)`
          : `0 0 0 1px ${C.line} inset`,
        display: "flex",
        alignItems: "center",
        gap: 12,
        transition: "all .2s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          paddingRight: 12,
          borderRight: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}
      >
        <div style={{ width: 22, height: 16, borderRadius: 3, overflow: "hidden", display: "flex" }}>
          <div style={{ flex: 1, background: "#D91023" }} />
          <div style={{ flex: 1, background: "#fff" }} />
          <div style={{ flex: 1, background: "#D91023" }} />
        </div>
        <span style={{ fontFamily: FONT_MONO, fontSize: 15, color: C.dim }}>+51</span>
      </div>
      <input
        autoFocus={autoFocus}
        type="tel"
        inputMode="tel"
        placeholder="987 654 321"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        style={{
          flex: 1,
          background: "transparent",
          border: 0,
          outline: "none",
          fontFamily: FONT_MONO,
          fontSize: 18,
          letterSpacing: "0.08em",
          color: "#fff",
          padding: 0,
        }}
      />
    </div>
  );
};

import type { ReactNode } from "react";
import { C, FONT_DISPLAY, FONT_MONO } from "./tokens";

export const LiveDot = ({ label = "EN VIVO" }: { label?: string }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: C.purple,
        boxShadow: "0 0 0 4px rgba(124,58,237,0.25), 0 0 12px rgba(124,58,237,0.9)",
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    />
    <span style={{ fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: "0.1em" }}>{label}</span>
  </span>
);

export const Stat = ({ n, k, tone, big }: { n: string; k: string; tone?: "green" | "purple"; big?: boolean }) => (
  <div>
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: big ? 26 : 30,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        color: tone === "green" ? C.green : tone === "purple" ? C.purple : "#fff",
        lineHeight: 1,
      }}
    >
      {n}
    </div>
    <div style={{ fontSize: 11, color: C.dim, marginTop: 6, letterSpacing: "0.04em" }}>{k}</div>
  </div>
);

export const Arrow = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M8 5l7 6-7 6" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Bolt = () => (
  <svg width="12" height="14" viewBox="0 0 12 14">
    <path d="M7 0L0 8h4l-1 6 7-8H6l1-6Z" fill={C.yellow} />
  </svg>
);

export const YapeBadge = () => (
  <div
    style={{
      padding: "6px 10px",
      borderRadius: 8,
      background: "#5C2D91",
      fontFamily: FONT_DISPLAY,
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.02em",
      color: "#fff",
      display: "inline-block",
    }}
  >
    Yape
  </div>
);

export const CardBadge = () => (
  <div
    style={{
      padding: "6px 10px",
      borderRadius: 8,
      background: "rgba(255,255,255,0.08)",
      fontSize: 12,
      fontWeight: 600,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      color: "#fff",
    }}
  >
    <svg width="16" height="11" viewBox="0 0 16 11">
      <rect width="16" height="11" rx="2" fill="#fff" fillOpacity="0.1" />
      <rect y="3" width="16" height="2" fill="#fff" fillOpacity="0.6" />
    </svg>
    Tarjeta
  </div>
);

export const Radio = ({ on }: { on?: boolean }) => (
  <div
    style={{
      width: 22,
      height: 22,
      borderRadius: 999,
      boxShadow: `0 0 0 1.5px ${on ? C.purple : "rgba(255,255,255,0.2)"} inset`,
      background: on ? C.purple : "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    {on && <div style={{ width: 8, height: 8, borderRadius: 999, background: "#fff" }} />}
  </div>
);

export const PriceRow = ({ label, value }: { label: ReactNode; value: ReactNode }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 }}>
    <span style={{ color: C.dim }}>{label}</span>
    <span>{value}</span>
  </div>
);

export const Dot = ({ color }: { color: string }) => (
  <span
    style={{
      width: 8,
      height: 8,
      borderRadius: 999,
      background: color,
      boxShadow: `0 0 8px ${color}`,
      display: "inline-block",
    }}
  />
);

export const MonoText = ({ children }: { children: ReactNode }) => (
  <span style={{ fontFamily: FONT_MONO }}>{children}</span>
);

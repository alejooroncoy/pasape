// Design tokens — Pasape (extraídos de pasape/project/screens.jsx)
export const C = {
  bg: "#0A0A0F",
  bg2: "#12121A",
  bg3: "#1A1A26",
  line: "rgba(255,255,255,0.08)",
  line2: "rgba(255,255,255,0.14)",
  text: "#FFFFFF",
  dim: "rgba(255,255,255,0.55)",
  dimmer: "rgba(255,255,255,0.32)",
  purple: "#7C3AED",
  purpleSoft: "rgba(124,58,237,0.18)",
  purpleEdge: "rgba(124,58,237,0.45)",
  green: "#22D17F",
  greenSoft: "rgba(34,209,127,0.14)",
  red: "#FF4D5E",
  redSoft: "rgba(255,77,94,0.14)",
  yellow: "#FFCE3B",
  yellowSoft: "rgba(255,206,59,0.14)",
} as const;

// Familias vía variables de next/font (layout raíz). No usar nombres literales
// ("General Sans"): next/font registra familias ofuscadas y el literal cae a system-ui.
export const FONT_DISPLAY =
  "var(--font-general-sans), system-ui, -apple-system, sans-serif";
export const FONT_BODY = FONT_DISPLAY;
export const FONT_MONO =
  "var(--font-jetbrains-mono), ui-monospace, monospace";

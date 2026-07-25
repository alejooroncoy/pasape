// Design tokens — Pasape (extraídos de pasape/project/screens.jsx)
//
// Los NEUTROS apuntan a las variables `--color-cart-*` (mismo valor dark por
// defecto que antes, pero se vuelven CLAROS dentro del scope `.home-light`). Así
// los forms de pago (Yape/tarjeta, estilos inline) heredan el tema de la
// superficie sin reescribir cada componente: oscuros en pantallas oscuras,
// claros en el checkout claro. Los colores de MARCA quedan fijos (funcionan en
// ambos temas).
export const C = {
  bg: "var(--color-cart-bg)",
  bg2: "var(--color-cart-bg-elev)",
  bg3: "var(--color-cart-bg-elev-2)",
  line: "var(--color-cart-line)",
  line2: "var(--color-cart-line-strong)",
  // Relleno tenue (inputs/superficies sutiles). NO hardcodear
  // "rgba(255,255,255,0.04)": eso asume fondo oscuro y se pierde en .home-light.
  fill: "var(--color-cart-line-2)",
  text: "var(--color-cart-ink)",
  dim: "var(--color-cart-ink-3)",
  dimmer: "var(--color-cart-ink-4)",
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

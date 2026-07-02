// Utilidades de contraste WCAG — para elegir texto/iconos legibles sobre
// colores dinámicos (paleta extraída de imágenes). Sin dependencias.

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Luminancia relativa WCAG (sRGB → lineal → ponderado).
function relativeLuminance([r, g, b]: Rgb): number {
  const chan = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [rl, gl, bl] = [chan(r), chan(g), chan(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** Ratio de contraste WCAG entre dos colores hex (1–21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexToRgb(hexA));
  const lb = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Blanco o negro — el que más contraste da contra `bgHex`. Reemplaza asumir
 * "si hay paleta, texto blanco": un acento claro (frecuente al extraer de
 * flyers) necesita texto oscuro encima, no blanco.
 */
export function readableTextColor(bgHex: string, dark = "#0a0a0f", light = "#ffffff"): string {
  return contrastRatio(bgHex, dark) >= contrastRatio(bgHex, light) ? dark : light;
}

/**
 * Oscurece `hex` si su luminancia supera `maxLum`, escalando RGB hacia abajo.
 * Usado para el tono "dark" de la paleta cuando sirve de FONDO grande detrás
 * de texto blanco fijo (header, contenedor de página, aside) — garantiza que
 * siga siendo lo bastante oscuro incluso si el bucket de píxeles oscuros del
 * flyer promedió más claro de lo esperado (flyers pastel/claros).
 */
export function ensureDarkBackground(hex: string, maxLum = 0.09): string {
  const rgb = hexToRgb(hex);
  const lum = relativeLuminance(rgb);
  if (lum <= maxLum) return hex;
  // Escala lineal simple: reduce cada canal en la misma proporción hasta
  // acercarse al techo de luminancia (aproximación suficiente, no necesita
  // ser exacta — solo evitar que quede claro).
  const scale = Math.sqrt(maxLum / lum);
  const [r, g, b] = rgb.map((c) => Math.round(c * scale));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function mixWithWhite(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Mezcla dos colores hex (0 = puro hexA, 1 = puro hexB). */
export function mixColors(hexA: string, hexB: string, amount: number): string {
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return `#${[mix(ar, br), mix(ag, bg), mix(ab, bb)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Texto secundario/terciario "muted" (ej. cart-ink-3/ink-4) pero armonizado
 * con la paleta: el gris frío fijo de esos tokens se ve apagado y desentona
 * sobre un fondo cálido (marrón/dorado de un flyer) — lo tiñe levemente hacia
 * `tintHex` y garantiza `minRatio` de contraste contra `bgHex` aclarando en
 * vez de saltar de tono.
 */
export function themedMutedText(
  baseHex: string,
  tintHex: string,
  bgHex: string,
  minRatio: number,
): string {
  const warmed = mixColors(baseHex, tintHex, 0.22);
  return ensureContrast(warmed, bgHex, baseHex, minRatio);
}

/**
 * Si `fgHex` no contrasta contra `bgHex`, lo ACLARA (mismo tono, más brillo)
 * en vez de saltar a un color de otra familia — dos colores cálidos de
 * luminancia parecida (ej. acento dorado sobre fondo marrón del mismo flyer)
 * pueden fallar el contraste WCAG aunque a simple vista se vean distintos;
 * aclarar mantiene la identidad del color en vez de reemplazarlo por el
 * morado de marca, que rompería la idea de "esta página combina con su
 * flyer". Solo cae a `fallback` si ni siquiera blanco puro alcanza el ratio
 * (fgHex prácticamente igual de claro que bgHex, caso raro).
 */
export function ensureContrast(
  fgHex: string,
  bgHex: string,
  fallback: string,
  minRatio = 2.5,
): string {
  if (contrastRatio(fgHex, bgHex) >= minRatio) return fgHex;
  for (const amount of [0.25, 0.5, 0.7, 0.85]) {
    const lightened = mixWithWhite(fgHex, amount);
    if (contrastRatio(lightened, bgHex) >= minRatio) return lightened;
  }
  return fallback;
}

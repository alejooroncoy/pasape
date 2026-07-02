"use client";

import { ensureDarkBackground, type Palette } from "./color";

// Extrae los 3 tonos de la paleta directamente del flyer que el organizador
// sube — 100% client-side (canvas), en el momento del upload. Es el mismo
// algoritmo (buckets por luminancia + pixel más saturado) que ya se usaba en
// `useImagePalette` y que combinaba bien: dark/mid salen de los píxeles
// reales de la imagen, no se derivan matemáticamente de un solo color. Nada
// se descarga ni reprocesa en el server — el resultado viaja ya calculado.

const SAMPLE = 32;

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// Para la portada YA guardada (editar evento) — no hay File local, solo la
// URL pública del storage. crossOrigin evita "tainted canvas" si el bucket
// manda CORS permisivo (Supabase Storage lo hace por defecto).
function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function extractPalette(img: HTMLImageElement): Palette | null {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null; // canvas tainted (sin CORS) — el caller cae al default de marca
  }

  type Bucket = { r: number; g: number; b: number; n: number };
  const dark: Bucket = { r: 0, g: 0, b: 0, n: 0 };
  const mid: Bucket = { r: 0, g: 0, b: 0, n: 0 };
  let accR = 124, accG = 58, accB = 237; // fallback: morado de marca
  let bestSat = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;

    if (lum < 80) { dark.r += r; dark.g += g; dark.b += b; dark.n++; }
    else if (lum < 190) { mid.r += r; mid.g += g; mid.b += b; mid.n++; }

    if (sat > bestSat && lum > 60 && lum < 210) {
      bestSat = sat;
      accR = r; accG = g; accB = b;
    }
  }

  const avg = (bk: Bucket, fallback: [number, number, number]): [number, number, number] =>
    bk.n > 0 ? [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n] : fallback;

  const [dr, dg, db] = avg(dark, [13, 11, 20]);
  const [mr, mg, mb] = avg(mid, [dr * 1.6, dg * 1.6, db * 1.6]);

  return {
    dark: ensureDarkBackground(toHex(dr, dg, db)),
    mid: toHex(mr, mg, mb),
    accent: toHex(accR, accG, accB),
  };
}

/** Paleta {dark, mid, accent} extraída del flyer recién subido, o null si no se pudo. */
export async function extractFlyerPalette(file: File): Promise<Palette | null> {
  try {
    const img = await loadImage(file);
    return extractPalette(img);
  } catch {
    return null;
  }
}

/** Igual, pero desde una URL (portada ya guardada, o el blob: URL del preview local). */
export async function extractFlyerPaletteFromUrl(url: string): Promise<Palette | null> {
  try {
    const img = await loadImageFromUrl(url);
    return extractPalette(img);
  } catch {
    return null;
  }
}

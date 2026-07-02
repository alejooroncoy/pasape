"use client";

import { useEffect, useState } from "react";
import { ensureDarkBackground } from "./color";

// Extrae colores dominantes de una imagen (client-side, sin deps).
// Dibuja la imagen en un canvas chico y separa los píxeles en buckets de
// luminancia para sacar un tono oscuro (base del gradiente) y un acento
// saturado (brillo). Estilo Spotify/Apple Music con el arte del álbum:
// el flyer nítido va al frente y estos colores rellenan el marco.

export type Palette = {
  /** Tono oscuro — base del gradiente. */
  dark: string;
  /** Acento medio — cuerpo del gradiente. */
  mid: string;
  /** Acento vivo — highlight del gradiente. */
  accent: string;
};

const SAMPLE = 32; // canvas de muestreo: 32×32 alcanza para color ambiente

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

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
    return null; // canvas tainted (sin CORS) → el caller usa el fallback
  }

  // Buckets por luminancia; dentro de cada uno acumulamos el promedio y
  // rastreamos el píxel más saturado como candidato a acento.
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

    // Acento: saturado y con luz razonable (ni negro ni blanco quemado)
    if (sat > bestSat && lum > 60 && lum < 210) {
      bestSat = sat;
      accR = r; accG = g; accB = b;
    }
  }

  const avg = (bk: Bucket, fallback: [number, number, number]): [number, number, number] =>
    bk.n > 0 ? [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n] : fallback;

  const [dr, dg, db] = avg(dark, [13, 11, 20]);   // #0D0B14 de marca
  const [mr, mg, mb] = avg(mid, [dr * 1.6, dg * 1.6, db * 1.6]);

  return {
    // El bucket "oscuro" promedia píxeles con lum<80 — en flyers muy claros
    // (pasteles) ese promedio puede quedar menos oscuro de lo que su nombre
    // promete. `ensureDarkBackground` lo fuerza a servir como fondo grande
    // detrás de texto blanco fijo (header, gradiente de página, aside).
    dark: ensureDarkBackground(toHex(dr, dg, db)),
    mid: toHex(mr, mg, mb),
    accent: toHex(accR, accG, accB),
  };
}

/**
 * Colores dominantes de una imagen remota. Devuelve null mientras carga o si
 * falla (CORS, 404, sin URL) — el consumidor cae a su gradiente de fallback.
 */
export function useImagePalette(url: string | null | undefined): Palette | null {
  const [palette, setPalette] = useState<Palette | null>(null);

  useEffect(() => {
    if (!url) {
      setPalette(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      setPalette(extractPalette(img));
    };
    img.onerror = () => {
      if (!cancelled) setPalette(null);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return palette;
}

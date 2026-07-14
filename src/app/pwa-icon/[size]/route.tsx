import type { NextRequest } from "next/server";
import { createPwaIcon } from "@/lib/seo/pwaIcon";

// Iconos de la PWA en rutas estables (/pwa-icon/192, /pwa-icon/512?maskable=1,
// /pwa-icon/180 para apple-touch). Se generan con next/og para hornear el fondo
// claro — ver pwaIcon.tsx. runtime nodejs: lee el PNG del perrito del disco.
export const runtime = "nodejs";

// Cache agresivo: el icono no cambia entre despliegues (cambia el código, no la
// URL). Un año, inmutable — el navegador/CDN no lo vuelve a pedir.
const CACHE = "public, max-age=31536000, immutable";

export async function GET(req: NextRequest, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const maskable = req.nextUrl.searchParams.get("maskable") === "1";
  const n = Math.min(1024, Math.max(48, Number.parseInt(size, 10) || 512));
  const res = await createPwaIcon(n, { maskable });
  res.headers.set("Cache-Control", CACHE);
  return res;
}

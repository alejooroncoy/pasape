import { createDefaultOgImage, DEFAULT_OG_SIZE } from "@/lib/seo/defaultOgImage";

export const runtime = "nodejs";
export const alt =
  "Pasape | Vende entradas, llena la pista y controla tu evento";
export const size = DEFAULT_OG_SIZE;
export const contentType = "image/png";

export default async function OpengraphImage() {
  return createDefaultOgImage();
}

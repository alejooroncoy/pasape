const SUPABASE_OBJECT_PREFIX = "/storage/v1/object/public/";

type Preset = {
  width: number;
  quality: number;
  format: "webp";
};

/** Tamaños alineados al viewport real — evita bajar 1.4 MB para un thumb de 256 px. */
const PRESETS = {
  /** Card del hero móvil (~256 px lógicos × 2 retina). */
  "hero-lcp": { width: 512, quality: 75, format: "webp" },
  /** Fondo difuminado desktop — con blur CSS basta un micro-thumb. */
  "hero-blur": { width: 64, quality: 50, format: "webp" },
  /** Cards horizontales del listado (~240 px). */
  card: { width: 480, quality: 75, format: "webp" },
  /** Medir aspect ratio sin bajar el original. */
  measure: { width: 32, quality: 40, format: "webp" },
} as const satisfies Record<string, Preset>;

export type ImagePreset = keyof typeof PRESETS;

export function optimizeImageUrl(
  url: string | null | undefined,
  preset: ImagePreset,
): string | null {
  if (!url) return null;
  if (!url.includes(SUPABASE_OBJECT_PREFIX)) return url;

  const { width, quality, format } = PRESETS[preset];
  const renderUrl = url.replace(SUPABASE_OBJECT_PREFIX, "/storage/v1/render/image/public/");
  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    format,
  });
  return `${renderUrl}?${params}`;
}

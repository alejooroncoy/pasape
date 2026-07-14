import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";

// Extraído de EventComposer.tsx para reusarlo también en el flujo de creación
// rápida para artistas independientes — misma subida a Storage, sin la
// extracción de paleta de marca (esa lógica sigue siendo privada de
// FlyerCard, que el flujo rápido no usa).
export const EVENT_ASSETS_BUCKET = "event-assets";

const slugifyForPath = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "event";

const extFromFile = (file: File): string => {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()! : "";
  if (fromName) return fromName.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const m = /\/([a-z0-9]+)/i.exec(file.type);
  return (m?.[1] ?? "bin").toLowerCase();
};

export async function uploadEventAsset(
  file: File,
  opts: { slugHint: string; kind: "cover" | "layout" },
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const folder = slugifyForPath(opts.slugHint);
  const path = `events/${folder}/${opts.kind}-${Date.now()}.${extFromFile(file)}`;
  const { error } = await supabase.storage
    .from(EVENT_ASSETS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw new Error(`upload_failed: ${error.message}`);
  const { data } = supabase.storage.from(EVENT_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

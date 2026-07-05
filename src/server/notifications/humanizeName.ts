// Normaliza nombres que llegan TODO EN MAYÚSCULAS (típico del padrón/DNI) a
// Title Case ("ALEJANDRO DANIEL ORONCOY" → "Alejandro Daniel Oroncoy").
// Solo actúa cuando el string está completamente en mayúsculas: los nombres
// que ya vienen con mayúscula/minúscula se dejan intactos para no romper
// casos como "McDonald" o "de la Cruz".

export function humanizeName(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (s !== s.toUpperCase()) return s; // ya tiene minúsculas → no tocar
  return s
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

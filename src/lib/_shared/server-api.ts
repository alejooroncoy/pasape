import "server-only";
import { cookies, headers } from "next/headers";

// Cliente server-side para PREFETCH: llama a nuestra PROPIA API REST (loopback),
// no al repositorio directo. Esto mantiene el frontend desacoplado del backend —
// el día que el backend salga de Next a otro servicio, solo cambia la baseUrl.
// Reenvía las cookies de sesión para que la API resuelva al mismo usuario.

const baseUrl = (h: Headers): string => {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
};

type ApiResponse<T> = { data?: T; error?: string };

export const serverApiGet = async <T>(path: string): Promise<T> => {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const res = await fetch(`${baseUrl(h)}${path}`, {
    headers: { cookie: c.toString() },
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as ApiResponse<T>;
  if (!res.ok || payload.error) {
    throw new Error(payload.error ?? `HTTP ${res.status}`);
  }
  return payload.data as T;
};

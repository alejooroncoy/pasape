// Base URL del backend Next. La SPA del portero no tiene servidor propio: todas
// las llamadas del código compartido (`@/lib/_shared/api-client`) van por rutas
// relativas `/api/...`; aquí fijamos `globalThis.__API_BASE__` para que se
// prefijen contra el backend remoto.
//
// Fuente: `VITE_API_URL` (build-time). Fallback: el origin actual (útil cuando
// se sirve la SPA detrás del mismo dominio que la API en dev/preview).
export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  (typeof location !== "undefined" ? location.origin : "");

export function installApiBase(): void {
  (globalThis as { __API_BASE__?: string }).__API_BASE__ = API_BASE;
}

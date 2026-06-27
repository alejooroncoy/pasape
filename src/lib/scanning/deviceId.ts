// Identificador estable del device del portero (binding de la sesión 24h).
// Persiste en localStorage; se genera la 1ª vez. Se envía en el header
// x-scanner-device en cada scan/sync para que el backend valide el binding.

const KEY = "pasape-scanner-device";
const TOKEN_KEY = "pasape-door-token";
export const SCANNER_DEVICE_HEADER = "x-scanner-device";
export const SCANNER_TOKEN_HEADER = "x-door-token";

// Token de portero (auth por código, sin cuenta). Se guarda al canjear el código
// y se manda en cada request; el backend resuelve la sesión por este token.
export function setDoorToken(token: string): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}
export function getDoorToken(): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}
export function clearDoorToken(): void {
  if (typeof localStorage !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

export function getDeviceId(): string {
  if (typeof localStorage === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

/** Headers de portero: device binding + token de sesión (si ya canjeó código). */
export function deviceHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const id = getDeviceId();
  if (id) h[SCANNER_DEVICE_HEADER] = id;
  const token = getDoorToken();
  if (token) h[SCANNER_TOKEN_HEADER] = token;
  return h;
}

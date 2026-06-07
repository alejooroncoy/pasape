// Identificador estable del device del portero (binding de la sesión 24h).
// Persiste en localStorage; se genera la 1ª vez. Se envía en el header
// x-scanner-device en cada scan/sync para que el backend valide el binding.

const KEY = "pasape-scanner-device";
export const SCANNER_DEVICE_HEADER = "x-scanner-device";

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

/** Headers con el device binding para peticiones de scan/sync. */
export function deviceHeaders(): Record<string, string> {
  const id = getDeviceId();
  return id ? { [SCANNER_DEVICE_HEADER]: id } : {};
}

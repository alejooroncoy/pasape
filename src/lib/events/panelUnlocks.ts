export type PanelFeatureKey = "promoters";

const STORAGE_PREFIX = "pasape:panel_unlock:";
export const PANEL_UNLOCK_EVENT = "pasape:panel-unlock";

export const isPanelFeatureUnlocked = (key: PanelFeatureKey): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_PREFIX + key) === "1";
};

// Dispara un evento propio (no "storage", que no se entera dentro de la misma
// pestaña) para que EventShell (tabs) y el contenido del Panel — dos instancias
// separadas del hook — se enteren al instante del desbloqueo sin recargar.
export const unlockPanelFeature = (key: PanelFeatureKey): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + key, "1");
  window.dispatchEvent(new CustomEvent(PANEL_UNLOCK_EVENT, { detail: key }));
};

import type { OrganizerType } from "@/lib/identity/organizerType";

export type ComposerMode = "simple" | "full";

const STORAGE_KEY = "pasape:composer_mode";

// Qué composer ve un organizador por defecto al crear un evento:
//  · Primera vez (sin preferencia guardada) → depende del tipo: independent_host
//    arranca en "simple" (quick-create), production_company/venue_owner en "full"
//    (EventComposer completo).
//  · Después de la primera vez, gana lo último que el usuario usó — si alguna
//    vez cambió al otro modo, ese es el default la próxima vez, sin importar
//    el tipo. Es una preferencia de sesión de trabajo, no una restricción de
//    producto: cualquiera puede alternar entre ambos con el toggle.
export const defaultComposerModeFor = (organizerType: OrganizerType | null): ComposerMode =>
  organizerType === "independent_host" ? "simple" : "full";

export const getComposerModePreference = (
  organizerType: OrganizerType | null,
): ComposerMode => {
  if (typeof window === "undefined") return defaultComposerModeFor(organizerType);
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "simple" || stored === "full") return stored;
  } catch {
    // localStorage inaccesible (Safari privado, etc.) — usa el default por tipo.
  }
  return defaultComposerModeFor(organizerType);
};

export const setComposerModePreference = (mode: ComposerMode): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // noop — preferencia no persiste, no es crítico.
  }
};

export const composerModeHref = (mode: ComposerMode): string =>
  mode === "simple" ? "/org/events/quick-create" : "/org/events/new";

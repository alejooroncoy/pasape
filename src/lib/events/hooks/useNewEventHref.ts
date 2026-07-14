"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import {
  composerModeHref,
  getComposerModePreference,
  type ComposerMode,
} from "@/lib/events/composerModePreference";

// Adónde manda el botón "Crear evento"/"Nuevo evento" en todo el panel: la
// versión rápida (independent_host, primera vez) o la completa (production_company/
// venue_owner, primera vez) — y después de la primera vez, lo último que el
// usuario haya usado, sin importar el tipo (ver composerModePreference.ts).
export const useNewEventHref = (): string => {
  const { data: me } = useCurrentUser();
  const organizerType = me?.user?.organizerType ?? null;
  const [mode, setMode] = useState<ComposerMode | null>(null);

  useEffect(() => {
    setMode(getComposerModePreference(organizerType));
  }, [organizerType]);

  // Antes de leer localStorage (primer render): usa el default por tipo para
  // no bloquear el link mientras carga — casi siempre coincide con lo que
  // termina resolviendo el efecto.
  return composerModeHref(mode ?? getComposerModePreference(organizerType));
};

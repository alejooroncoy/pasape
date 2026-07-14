"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { PANEL_UNLOCK_EVENT, isPanelFeatureUnlocked, unlockPanelFeature } from "@/lib/events/panelUnlocks";

// Artistas independientes arrancan con el panel reducido (sin Promotores) —
// la mayoría vende directo sin red de promotores. Cualquier otro tipo lo ve
// siempre. Un tap en "Activar promotores" lo desbloquea para siempre (localStorage).
export const usePanelPromotersVisible = (): { visible: boolean; unlock: () => void } => {
  const { data: me } = useCurrentUser();
  const organizerType = me?.user?.organizerType ?? null;
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(isPanelFeatureUnlocked("promoters"));
    const onUnlock = () => setUnlocked(true);
    window.addEventListener(PANEL_UNLOCK_EVENT, onUnlock);
    return () => window.removeEventListener(PANEL_UNLOCK_EVENT, onUnlock);
  }, []);

  const simplified = organizerType === "independent_host";
  const visible = !simplified || unlocked;

  const unlock = () => {
    unlockPanelFeature("promoters");
    setUnlocked(true);
  };

  return { visible, unlock };
};

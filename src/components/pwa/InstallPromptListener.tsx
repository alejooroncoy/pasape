"use client";

import { useEffect } from "react";
import { setDeferredPrompt, setInstalled } from "@/lib/pwa/installPromptStore";

// Captura `beforeinstallprompt` apenas Chrome lo dispare, sin importar qué
// página esté montada en ese momento — así /order y /tickets/[id] siempre lo
// encuentran ya guardado cuando el usuario llega a esas rutas. Sin esto, el
// evento (que Chrome solo emite una vez) se perdería si nadie estaba
// escuchando todavía.
export function InstallPromptListener() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Parameters<typeof setDeferredPrompt>[0]);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

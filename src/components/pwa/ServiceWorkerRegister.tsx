"use client";

import { useEffect } from "react";

// Registra el service worker (public/sw.js) solo en producción. En dev no, para
// evitar que la cache del SW sirva contenido viejo mientras desarrollas.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin SW la app funciona igual, solo sin offline */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}

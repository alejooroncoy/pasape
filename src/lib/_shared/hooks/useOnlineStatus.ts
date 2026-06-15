"use client";

import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  // Iniciar siempre con true para que SSR y primer render del cliente coincidan.
  // El valor real se sincroniza en el primer useEffect (solo en el cliente).
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Sincronizar el valor real inmediatamente al montar
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}

"use client";

import { useEffect, useState } from "react";

// Estado de conexión del navegador. Offline deshabilitamos acciones que
// requieren red (transferir, cancelar) — ver/mostrar el QR sí funciona offline.
export const useOnline = (): boolean => {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
};

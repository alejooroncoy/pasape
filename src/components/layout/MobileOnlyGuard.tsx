"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useSessionReady } from "@/lib/identity/hooks/useSessionReady";

// Las páginas del asistente (entradas, favoritos, perfil) tienen layout de
// desktop, pero en desktop SIN sesión no hay nada que mostrar: redirigimos al
// home. Si hay sesión, se entra normal en cualquier ancho.
//
// El chequeo de viewport es client-side a propósito: el server no conoce el
// ancho de pantalla y estas vistas son offline-first (matchMedia es 100% local,
// no toca red).
export function MobileOnlyGuard() {
  const router = useRouter();
  const { sessionReady, loggedIn } = useSessionReady();

  useEffect(() => {
    // Logueado → nunca rebota (y si la sesión aparece tarde, este efecto se
    // re-ejecuta y el cleanup cancela cualquier redirect pendiente).
    if (loggedIn || !sessionReady) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    if (!mq.matches) return;
    // Margen de gracia: damos tiempo a que React Query revalide la sesión tras
    // restaurar el cache persistido. Si en ese rato apareces logueado, el
    // cleanup mata el timer y no rebotas. 3s (no 1.5s) porque supabase.auth
    // .getUser() es una llamada de red real al servidor de Auth, no una
    // lectura local del JWT — puede tardar bajo latencia o rate limiting.
    const t = setTimeout(() => router.replace("/" as never), 3000);
    return () => clearTimeout(t);
  }, [router, sessionReady, loggedIn]);

  return null;
}

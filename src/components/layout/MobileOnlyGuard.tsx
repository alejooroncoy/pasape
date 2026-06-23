"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

// Las páginas del asistente (entradas, favoritos, perfil) tienen layout de
// desktop, pero en desktop SIN sesión no hay nada que mostrar: redirigimos al
// home. Si hay sesión, se entra normal en cualquier ancho.
//
// El chequeo de viewport es client-side a propósito: el server no conoce el
// ancho de pantalla y estas vistas son offline-first (matchMedia es 100% local,
// no toca red).
export function MobileOnlyGuard() {
  const router = useRouter();
  const me = useCurrentUser();
  // Mientras resuelve la sesión no decidimos, para no rebotar a un logueado.
  const loggedIn = !!me.data?.user;
  const settled = !me.isLoading;

  useEffect(() => {
    if (!settled || loggedIn) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const check = () => {
      if (mq.matches) router.replace("/" as never);
    };
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, [router, settled, loggedIn]);

  return null;
}

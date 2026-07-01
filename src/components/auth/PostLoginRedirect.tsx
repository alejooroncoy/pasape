"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

const KEY = "pasape:oauth_return";
// Última cuenta cuya sesión conoció el service worker. Sirve para detectar un
// cambio de sesión (login, logout o cambio de cuenta) y avisarle al SW que
// limpie su cache de wallet — sin esto, la cache de /api/identity/me y
// /api/tickets/* en Cache Storage no distingue por cookie/usuario, así que un
// segundo login en el mismo device podría heredar (u ofrecer offline) los
// datos de la cuenta anterior.
const SW_SESSION_KEY = "pasape:sw-session-uid";

// Robustez del retorno post-login. Supabase a veces no respeta nuestro
// /auth/callback y deja la sesión en la Site URL (la home) en vez de devolver a
// la página de origen (unlock / claim). Guardamos a dónde volver ANTES del OAuth
// y, apenas hay sesión, llevamos al usuario ahí — sin importar dónde lo dejó MP… digo, Supabase.
export function setOauthReturn(path: string) {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {}
}

export function PostLoginRedirect() {
  const me = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!me.data?.user) return;
    let target: string | null = null;
    try {
      target = sessionStorage.getItem(KEY);
    } catch {}
    if (!target) return;
    // Ya estás donde querías volver → solo limpia (evita loop).
    if (target === pathname || target.startsWith(`${pathname}?`)) {
      try {
        sessionStorage.removeItem(KEY);
      } catch {}
      return;
    }
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    router.replace(target);
  }, [me.data?.user, pathname, router]);

  // Detecta cambios de sesión (incluye el primer login) y le avisa al SW.
  useEffect(() => {
    if (me.isPending) return; // aún no sabemos el estado real: no tocar nada
    const currentUid = me.data?.user?.id ?? null;
    let lastUid: string | null = null;
    try {
      lastUid = localStorage.getItem(SW_SESSION_KEY);
    } catch {}
    if (currentUid === lastUid) return;
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_WALLET_CACHE" });
    try {
      if (currentUid) localStorage.setItem(SW_SESSION_KEY, currentUid);
      else localStorage.removeItem(SW_SESSION_KEY);
    } catch {}
  }, [me.isPending, me.data?.user?.id]);

  return null;
}

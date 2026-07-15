"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { useCurrentUser } from "./useCurrentUser";

const pendingActionKey = (scope: string, id: string) =>
  `pasape:pending_${scope}:${id}`;

/**
 * Gate genérico para acciones que requieren sesión (seguir, guardar, etc.).
 * Invitado → abre el SignInDrawer sin salir de la página; al loguear, la
 * acción se dispara sola. El login de Google es hard-navigation (OAuth →
 * /auth/callback), que remonta la página entera: un useRef en memoria no
 * sobrevive ese viaje, por eso la intención se persiste en sessionStorage
 * (mismo patrón que setOauthReturn/PostLoginRedirect).
 *
 * `scope` + `id` identifican la acción pendiente (ej. "follow"/orgId,
 * "save"/eventId) para no cruzar intents de distintos botones en la misma
 * pestaña.
 *
 * `action` corre en el click directo ya logueado (toggle sin condición: si
 * ya seguía, deja de seguir). `resumeAction` corre al volver de loguearse —
 * por defecto es `action`, pero puede pasarse una versión idempotente (ej.
 * "solo sigue si todavía no sigue") para blindar contra un efecto que se
 * dispare dos veces en dev (StrictMode) sin des-hacer la acción que el
 * invitado pidió.
 */
export const useAuthGatedAction = (
  scope: string,
  id: string,
  action: () => void,
  resumeAction: () => void = action,
) => {
  const pathname = usePathname();
  const me = useCurrentUser();
  const loggedIn = !!me.data?.user;
  const [signInOpen, setSignInOpen] = useState(false);
  const resumeActionRef = useRef(resumeAction);
  resumeActionRef.current = resumeAction;

  useEffect(() => {
    if (!loggedIn) return;
    let pending = false;
    try {
      pending = sessionStorage.getItem(pendingActionKey(scope, id)) === "1";
    } catch {
      /* sessionStorage inaccesible — sin auto-disparo, no rompe nada más */
    }
    if (!pending) return;
    try {
      sessionStorage.removeItem(pendingActionKey(scope, id));
    } catch {}
    resumeActionRef.current();
  }, [loggedIn, scope, id]);

  const run = () => {
    if (!loggedIn) {
      try {
        sessionStorage.setItem(pendingActionKey(scope, id), "1");
      } catch {}
      setSignInOpen(true);
      return;
    }
    action();
  };

  const closeDrawer = () => {
    setSignInOpen(false);
    // Canceló sin loguearse: limpia el flag para que no quede huérfano y
    // dispare la acción sin pedirla si más tarde se loguea desde otro flujo
    // en la misma pestaña. Si SÍ se logueó, el efecto de arriba ya consumió
    // y borró el flag antes de que esto corra.
    if (!loggedIn) {
      try {
        sessionStorage.removeItem(pendingActionKey(scope, id));
      } catch {}
    }
  };

  return { loggedIn, run, signInOpen, closeDrawer, redirectTo: pathname };
};

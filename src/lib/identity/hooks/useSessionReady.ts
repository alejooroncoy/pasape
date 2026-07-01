"use client";

import { useCurrentUser } from "./useCurrentUser";

// Sesión lista para decidir UI (wallet, guards, enable de queries hijas).
// Usa isPending (aún sin snapshot en memoria) en vez de esperar isFetching: con
// cache persistido, offline el refetch puede colgar hasta el timeout del
// navegador/SW y deja la wallet en skeleton infinito aunque IndexedDB ya tenga
// usuario + entradas.
export const useSessionReady = () => {
  const me = useCurrentUser();
  return {
    me,
    sessionReady: !me.isPending,
    loggedIn: !!me.data?.user,
  };
};

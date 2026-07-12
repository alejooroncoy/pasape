"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import {
  AppHeader,
  HeaderActions,
  HeaderBrand,
  HeaderCity,
  HeaderSpacer,
  type NavUser,
} from "./AppHeader";
import { SideDrawer } from "./SideDrawer";
import { SignInDrawer } from "./SignInDrawer";

// Header de las páginas de usuario (tickets, perfil). Misma composición que la
// home pero SIN buscador ni strip de categorías — solo marca, ciudad y cuenta.
// Trae su propio SideDrawer + SignInDrawer para que el menú/cuenta funcionen.
//
// `initialUser`: sesión YA resuelta por el server (RSC). El PRIMER render (SSR +
// hidratación) la usa — determinista, sin depender del cache persistido en
// IndexedDB que se rehidrata async y causaba el mismatch server/cliente. Tras
// montar, `useCurrentUser` manda de nuevo (offline-correcto: el cache por-usuario
// refleja tu identidad aunque el shell cacheado por-URL no). Si NO se provee
// `initialUser`, se mantiene el comportamiento previo (no regresiona otras
// páginas que aún no lo siembran).
export function UserHeader({
  tint,
  initialUser,
}: { tint?: string; initialUser?: NavUser | null } = {}) {
  const me = useCurrentUser();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const liveUser = me.data?.user
    ? { fullName: me.data.user.fullName, avatarUrl: me.data.user.avatarUrl }
    : null;
  const user =
    initialUser === undefined ? liveUser : hydrated ? liveUser : initialUser;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <>
      <AppHeader tint={tint}>
        <HeaderBrand mobileLabel />
        <HeaderCity />
        <HeaderSpacer />
        <HeaderActions user={user} onOpenMenu={() => setDrawerOpen(true)} />
      </AppHeader>

      <SideDrawer
        user={user}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSignIn={() => setSignInOpen(true)}
        onSelectCategory={() => router.push("/")}
      />
      <SignInDrawer open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}

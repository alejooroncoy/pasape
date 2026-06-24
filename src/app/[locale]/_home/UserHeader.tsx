"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import {
  AppHeader,
  HeaderActions,
  HeaderBrand,
  HeaderCity,
  HeaderSpacer,
} from "./AppHeader";
import { SideDrawer } from "./SideDrawer";
import { SignInDrawer } from "./SignInDrawer";

// Header de las páginas de usuario (tickets, perfil). Misma composición que la
// home pero SIN buscador ni strip de categorías — solo marca, ciudad y cuenta.
// Trae su propio SideDrawer + SignInDrawer para que el menú/cuenta funcionen.
export function UserHeader() {
  const me = useCurrentUser();
  const router = useRouter();
  const user = me.data?.user
    ? { fullName: me.data.user.fullName, avatarUrl: me.data.user.avatarUrl }
    : null;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <>
      <AppHeader>
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

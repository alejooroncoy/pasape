"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import {
  AppHeader,
  HeaderBrand,
  HeaderCity,
  HeaderSpacer,
} from "@/app/[locale]/_home/AppHeader";
import { SideDrawer } from "@/app/[locale]/_home/SideDrawer";
import { SignInDrawer } from "@/app/[locale]/_home/SignInDrawer";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { SellerCta } from "./SellerCta";

// Header MÍNIMO de la zona logueada (tickets, favoritos, perfil). A diferencia
// de UserHeader (que lleva "Mis entradas" + avatar), aquí en DESKTOP la identidad
// y la navegación viven en el rail lateral (UserSidebar) — repetirlas arriba era
// el duplicado que se veía raro. Así que el header solo aporta:
//
//   marca · ciudad · —— · CTA de vendedor            (siempre)
//   + botón de menú (SideDrawer)                       (solo <lg, sin rail)
//
// En móvil/tablet no hay rail, así que el botón de menú da acceso a la cuenta
// (perfil, cerrar sesión) vía el mismo SideDrawer del resto de la app.
const TAP_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const;

export function UserZoneHeader() {
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
        <SellerCta />

        {/* Menú: solo donde no hay rail lateral (<lg). En desktop el rail ya
            tiene navegación + identidad, así que aquí no va nada más. */}
        <motion.button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Menú"
          whileTap={{ scale: 0.9 }}
          transition={TAP_SPRING}
          className="hidden size-10 place-items-center rounded-full border border-cart-line bg-cart-bg-elev max-[1023px]:grid"
        >
          <span className="block h-px w-4 bg-cart-ink-2 relative before:absolute before:top-[-5px] before:block before:h-px before:w-4 before:bg-cart-ink-2 before:content-[''] after:absolute after:top-[5px] after:block after:h-px after:w-4 after:bg-cart-ink-2 after:content-['']" />
        </motion.button>
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

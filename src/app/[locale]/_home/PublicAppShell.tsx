"use client";

import { useState, type ReactNode } from "react";
import type { EventCategory } from "@/server/events/domain/Event";
import { Nav, type NavUser } from "./Nav";
import { Footer } from "./Footer";
import { WaFloat } from "./WaFloat";
import { AmbientGlow } from "./AmbientGlow";
import { UserTabbar } from "@/components/layout/UserTabbar";
import { SideDrawer } from "./SideDrawer";
import { SignInDrawer } from "./SignInDrawer";

type Props = {
  user: NavUser | null;
  children: ReactNode;
  /** Ancho del contenido central. */
  contentClassName?: string;
};

export function PublicAppShell({
  user,
  children,
  contentClassName = "mx-auto max-w-[900px]",
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [category, setCategory] = useState<EventCategory | null>(null);

  return (
    <div className="home-light cart-grain relative min-h-screen overflow-hidden bg-cart-bg text-cart-ink font-sans">
      <AmbientGlow />
      <div className="relative z-[1]">
        <Nav
          user={user}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenSignIn={() => setSignInOpen(true)}
          onSearch={() => {}}
          onSelectCategory={setCategory}
          selectedCategory={category}
        />
        <main className="px-[clamp(20px,4vw,56px)] py-8 pb-[88px] lg:pb-12">
          <div className={contentClassName}>{children}</div>
        </main>
        <Footer />
        <WaFloat />
        <UserTabbar />
        <SideDrawer
          user={user}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSignIn={() => setSignInOpen(true)}
          onSelectCategory={setCategory}
        />
        <SignInDrawer open={signInOpen} onClose={() => setSignInOpen(false)} />
      </div>
    </div>
  );
}

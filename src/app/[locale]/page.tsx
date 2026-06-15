"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { EventCategory } from "@/server/events/domain/Event";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { Nav } from "./_home/Nav";
import { NextEventHero } from "./_home/NextEventHero";
import { HeroCarousel } from "./_home/HeroCarousel";
import { EventsSection } from "./_home/EventsSection";
import { Footer } from "./_home/Footer";
import { WaFloat } from "./_home/WaFloat";
import { MobileTabbar } from "./_home/MobileTabbar";
import { SideDrawer } from "./_home/SideDrawer";
import { SignInDrawer } from "./_home/SignInDrawer";

export default function HomePage() {
  const router = useRouter();
  const me = useCurrentUser();
  const loggedIn = !!me.data?.user;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [search, setSearch] = useState("");
  const eventsSectionRef = useRef<HTMLElement>(null);

  const selectCategoryFromNav = (cat: EventCategory | null) => {
    setCategory(cat);
    setTimeout(() => {
      eventsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <div className="cart-grain relative min-h-screen overflow-hidden bg-cart-bg text-white font-sans">
      {/* Underglow morado ambiente — vive detrás de todo el viewport y le da
          la atmósfera "stained purple" que se ve en el diseño. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-100px] z-0 h-[1000px] w-[1500px] -translate-x-1/2 blur-[80px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(184,124,255,0.28), rgba(168,85,247,0.12) 40%, transparent 70%)",
        }}
      />
      {/* Segundo glow más abajo para mantener atmosfera en el scroll */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[80%] top-[60vh] z-0 h-[700px] w-[800px] -translate-x-1/2 blur-[100px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(184,124,255,0.10), transparent 70%)",
        }}
      />
      <div className="relative z-[1]">
      <Nav
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenSignIn={() => setSignInOpen(true)}
        onSearch={setSearch}
        onSelectCategory={selectCategoryFromNav}
        selectedCategory={category}
      />
      <main className="max-[560px]:pb-[72px]">
        {loggedIn && <NextEventHero />}
        <HeroCarousel />
        <EventsSection sectionRef={eventsSectionRef} category={category} onCategoryChange={setCategory} search={search} />
      </main>
      <Footer />
      <WaFloat />
      <MobileTabbar
        onTickets={() => (loggedIn ? router.push("/tickets" as never) : setSignInOpen(true))}
        onAccount={() => (loggedIn ? router.push("/account" as never) : setSignInOpen(true))}
      />
      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSignIn={() => setSignInOpen(true)}
      />
      <SignInDrawer open={signInOpen} onClose={() => setSignInOpen(false)} />
      </div>
    </div>
  );
}

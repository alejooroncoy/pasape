"use client";

import { useEffect, useRef, useState } from "react";
import type { EventCategory } from "@/server/events/domain/Event";
import { clientEvents } from "@/lib/analytics/clientEvents";
import { Nav, type NavUser } from "./Nav";
import { NextEventHero } from "./NextEventHero";
import { HeroCarousel } from "./HeroCarousel";
import { EventsSection } from "./EventsSection";
import { Footer } from "./Footer";
import { WaFloat } from "./WaFloat";
import { UserTabbar } from "@/components/layout/UserTabbar";
import { SideDrawer } from "./SideDrawer";
import { SignInDrawer } from "./SignInDrawer";

export function HomeClient({ user }: { user: NavUser | null }) {
  const loggedIn = !!user;
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

  const lastSearchTracked = useRef("");
  useEffect(() => {
    const q = search.trim();
    if (!q || q === lastSearchTracked.current) return;
    const timer = setTimeout(() => {
      lastSearchTracked.current = q;
      clientEvents.search({ query: q, location: "home" });
    }, 600);
    return () => clearTimeout(timer);
  }, [search]);

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
        user={user}
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenSignIn={() => setSignInOpen(true)}
        onSearch={setSearch}
        onSelectCategory={selectCategoryFromNav}
        selectedCategory={category}
      />
      <main className="pb-[72px] lg:pb-0">
        {loggedIn && <NextEventHero />}
        <HeroCarousel />
        <EventsSection sectionRef={eventsSectionRef} category={category} onCategoryChange={setCategory} search={search} />
      </main>
      <Footer />
      <WaFloat />
      <UserTabbar />
      <SideDrawer
        user={user}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSignIn={() => setSignInOpen(true)}
        onSelectCategory={selectCategoryFromNav}
      />
      <SignInDrawer open={signInOpen} onClose={() => setSignInOpen(false)} />
      </div>
    </div>
  );
}

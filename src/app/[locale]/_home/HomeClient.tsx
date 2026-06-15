"use client";

import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { EventCategory } from "@/server/events/domain/Event";
import { Nav, type NavUser } from "./Nav";
import { NextEventHero } from "./NextEventHero";
import { HeroCarousel } from "./HeroCarousel";
import { EventsSection } from "./EventsSection";
import { Footer } from "./Footer";
import { WaFloat } from "./WaFloat";
import { MobileTabbar } from "./MobileTabbar";
import { SideDrawer } from "./SideDrawer";
import { SignInDrawer } from "./SignInDrawer";

export function HomeClient({ user }: { user: NavUser | null }) {
  const router = useRouter();
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
      <main className="max-[560px]:pb-[72px]">
        {loggedIn && <NextEventHero />}
        <HeroCarousel />
        <EventsSection sectionRef={eventsSectionRef} category={category} onCategoryChange={setCategory} search={search} />
      </main>
      <Footer />
      <WaFloat />
      <MobileTabbar
        onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onExplore={() =>
          eventsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        onTickets={() => (loggedIn ? router.push("/tickets" as never) : setSignInOpen(true))}
        onFavs={() => (loggedIn ? router.push("/profile" as never) : setSignInOpen(true))}
        onAccount={() => (loggedIn ? router.push("/profile" as never) : setSignInOpen(true))}
      />
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

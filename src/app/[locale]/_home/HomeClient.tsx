"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EventCategory } from "@/server/events/domain/Event";
import { clientEvents } from "@/lib/analytics/clientEvents";
import { Nav, type NavUser } from "./Nav";
import { NextEventHero } from "./NextEventHero";
import { HeroCarousel } from "./HeroCarousel";
import { EventsSection } from "./EventsSection";
import { Footer } from "./Footer";
import { WaFloat } from "./WaFloat";
import { AmbientGlow } from "./AmbientGlow";
import { SeoBrowseLead } from "@/components/seo/SeoBrowseLead";
import { UserTabbar } from "@/components/layout/UserTabbar";
import { SideDrawer } from "./SideDrawer";
import { SignInDrawer } from "./SignInDrawer";

export type SeoLead = {
  h1: string;
  description: string;
  breadcrumbs?: ReactNode;
  category?: EventCategory | null;
};

type Props = {
  user: NavUser | null;
  initialCategory?: EventCategory | null;
  showHero?: boolean;
  seoLead?: SeoLead | null;
  searchLocation?: string;
};

export function HomeClient({
  user,
  initialCategory = null,
  showHero = true,
  seoLead = null,
  searchLocation = "home",
}: Props) {
  const loggedIn = !!user;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [category, setCategory] = useState<EventCategory | null>(initialCategory);
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
      clientEvents.search({ query: q, location: searchLocation });
    }, 600);
    return () => clearTimeout(timer);
  }, [search, searchLocation]);

  return (
    <div className="cart-grain relative min-h-screen overflow-hidden bg-cart-bg text-white font-sans">
      <AmbientGlow />
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
          {showHero && loggedIn && <NextEventHero />}
          {showHero && <HeroCarousel />}
          {seoLead ? (
            <SeoBrowseLead
              h1={seoLead.h1}
              description={seoLead.description}
              breadcrumbs={seoLead.breadcrumbs}
              category={seoLead.category ?? initialCategory}
            />
          ) : null}
          <EventsSection
            sectionRef={eventsSectionRef}
            category={category}
            onCategoryChange={setCategory}
            search={search}
            compactHeader={!!seoLead}
          />
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

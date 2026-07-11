"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { EventCategory } from "@/server/events/domain/Event";
import { clientEvents } from "@/lib/analytics/clientEvents";
import { Nav, type NavUser } from "./Nav";
import { NextEventHero } from "./NextEventHero";
import { FeaturedBanner } from "./FeaturedBanner";
import { HomeSidebar } from "./HomeSidebar";
import { EventsSection } from "./EventsSection";
import { Footer } from "./Footer";
import { SeoBrowseLead } from "@/components/seo/SeoBrowseLead";
import { UserTabbar } from "@/components/layout/UserTabbar";

const SideDrawer = dynamic(() => import("./SideDrawer").then((m) => ({ default: m.SideDrawer })), {
  ssr: false,
});
const SignInDrawer = dynamic(() => import("./SignInDrawer").then((m) => ({ default: m.SignInDrawer })), {
  ssr: false,
});

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
  /** "light" = fondo blanco + wash sutil (default, aprobado). "dark-ambient" =
   *  variante de comparación en /2, fondo oscuro con degradado con movimiento
   *  a la Partiful (sin el blob estático de antes). */
  variant?: "light" | "dark-ambient";
};

export function HomeClient({
  user,
  initialCategory = null,
  showHero = true,
  seoLead = null,
  searchLocation = "home",
  variant = "light",
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

  const wrapperClass =
    variant === "dark-ambient"
      ? "home-dark-ambient cart-grain relative min-h-screen overflow-hidden text-cart-ink font-sans"
      : "home-light home-wash cart-grain relative min-h-screen overflow-hidden bg-cart-bg text-cart-ink font-sans";

  return (
    <div className={wrapperClass}>
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
          {seoLead ? (
            <>
              <SeoBrowseLead
                h1={seoLead.h1}
                description={seoLead.description}
                breadcrumbs={seoLead.breadcrumbs}
                category={seoLead.category ?? initialCategory}
              />
              <EventsSection
                sectionRef={eventsSectionRef}
                category={category}
                onCategoryChange={setCategory}
                search={search}
                compactHeader
              />
            </>
          ) : (
            /* Layout de dos columnas del home (patrón Joinnus): contenido
               principal a la izquierda, sidebar útil a la derecha bajando
               junto a él. En mobile el sidebar se apila debajo. */
            <div className="mx-auto grid max-w-[1320px] items-start gap-4 px-[clamp(20px,4vw,56px)] py-[clamp(16px,2.5vw,28px)] lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex min-w-0 flex-col gap-4">
                <FeaturedBanner />
                {/* Sin prop `search`: en el home la búsqueda vive en el
                    dropdown del header (backend); la grilla no se filtra al
                    tipear. En las rutas SEO sí se mantiene el filtro. */}
                <EventsSection
                  sectionRef={eventsSectionRef}
                  category={category}
                  onCategoryChange={setCategory}
                  framed
                />
              </div>
              <HomeSidebar />
            </div>
          )}
        </main>
        <Footer />
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


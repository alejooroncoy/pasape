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
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

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
  // El shell público llega desde ISR. La identidad es privada y se resuelve
  // después de hidratar; así una cookie no invalida el cache compartido.
  const currentUser = useCurrentUser();
  const resolvedUser =
    user ??
    (currentUser.data?.user
      ? {
          fullName: currentUser.data.user.fullName,
          avatarUrl: currentUser.data.user.avatarUrl,
        }
      : null);
  const loggedIn = !!resolvedUser;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [category, setCategory] = useState<EventCategory | null>(initialCategory);
  const [search, setSearch] = useState("");
  const eventsSectionRef = useRef<HTMLElement>(null);

  // Seleccionar categoría solo filtra en el sitio — sin auto-scroll. El salto
  // hacia la sección se sentía brusco en móvil; el usuario ya ve la grilla
  // reaccionar sin que la página se mueva.
  const selectCategoryFromNav = (cat: EventCategory | null) => {
    setCategory(cat);
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

  // `overflow-x-clip` y NO `overflow-hidden`: `hidden` en un eje fuerza el otro
  // a `auto`, o sea convierte este div en el scrollport del header sticky y lo
  // deja scrolleando con la página (en móvil el buscador y los filtros son el
  // único acceso a búsqueda/categoría, así que desaparecían). `clip` contiene el
  // desborde horizontal sin crear contenedor de scroll.
  const wrapperClass =
    variant === "dark-ambient"
      ? "home-dark-ambient cart-grain relative min-h-screen overflow-x-clip text-cart-ink font-sans"
      : "home-light home-wash cart-grain relative min-h-screen overflow-x-clip bg-cart-bg text-cart-ink font-sans";

  return (
    <div className={wrapperClass}>
      {/* El padding del tabbar vive acá y no en <main>: el footer queda fuera de
          main y su última fila (enlace al Libro de Reclamaciones, obligatorio)
          terminaba tapada por el tabbar fijo. */}
      <div className="relative z-[1] pb-[calc(env(safe-area-inset-bottom,0px)+72px)] lg:pb-0">
        <Nav
          user={resolvedUser}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenSignIn={() => setSignInOpen(true)}
          onSearch={setSearch}
          onSelectCategory={selectCategoryFromNav}
          selectedCategory={category}
        />
        <main>
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
          user={resolvedUser}
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

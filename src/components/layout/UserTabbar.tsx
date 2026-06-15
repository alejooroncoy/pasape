"use client";

import type { ReactElement, SVGProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  CompassIcon,
  HeartIcon,
  HomeIcon,
  TicketIcon,
  UserIcon,
} from "@/app/[locale]/_home/icons";

// Nav inferior persistente para las páginas de usuario (tickets, perfil,
// cuenta). A diferencia del de la home —que hace scroll dentro de la página—,
// este navega por ruta y resalta el tab activo según la URL actual.
type Tab = {
  id: string;
  label: string;
  href: string;
  Icon: (p: SVGProps<SVGSVGElement>) => ReactElement;
  dot?: boolean;
};

const TABS: Tab[] = [
  { id: "home", label: "Inicio", href: "/", Icon: HomeIcon },
  { id: "explore", label: "Explorar", href: "/events", Icon: CompassIcon },
  { id: "tickets", label: "Mis entradas", href: "/tickets", Icon: TicketIcon, dot: true },
  { id: "favs", label: "Favoritos", href: "/profile", Icon: HeartIcon },
  { id: "me", label: "Cuenta", href: "/profile", Icon: UserIcon },
];

function activeId(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/events")) return "explore";
  if (pathname.startsWith("/tickets")) return "tickets";
  if (pathname.startsWith("/profile") || pathname.startsWith("/account")) return "me";
  return "";
}

export function UserTabbar() {
  const pathname = usePathname();
  const active = activeId(pathname);
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-[70] block border-t border-cart-line bg-cart-bg/90 backdrop-blur-xl backdrop-saturate-150 px-1 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+8px)]"
    >
      <div className="mx-auto grid max-w-[540px] grid-cols-5">
        {TABS.map(({ id, label, href, Icon, dot }) => {
          const isOn = active === id;
          return (
            <Link
              key={id}
              href={href as never}
              aria-current={isOn ? "page" : undefined}
              className={`relative flex flex-col items-center gap-1 border-0 bg-transparent px-0.5 py-1.5 text-[10.5px] font-medium transition-colors ${
                isOn ? "text-cart-accent" : "text-cart-ink-3"
              }`}
            >
              {isOn && (
                <span
                  aria-hidden
                  className="absolute -top-2 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-b bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent)]"
                />
              )}
              <Icon />
              {label}
              {dot && (
                <span
                  aria-hidden
                  className="absolute top-1 right-[calc(50%-16px)] size-[7px] rounded-full bg-cart-accent shadow-[0_0_6px_var(--color-cart-accent)]"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

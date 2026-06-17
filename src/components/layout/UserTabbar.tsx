"use client";

import type { ReactElement, SVGProps } from "react";
import { motion } from "motion/react";
import { Link, usePathname } from "@/i18n/navigation";
import {
  HeartIcon,
  HomeIcon,
  TicketIcon,
  UserIcon,
} from "@/app/[locale]/_home/icons";

// Nav inferior persistente para el comprador en móvil/tablet (oculto en ≥lg,
// donde manda el rail lateral). Navega por ruta y resalta el tab activo.
// Componente único compartido por todas las superficies del comprador
// (home, tickets, perfil, favoritos) — micro-animaciones centralizadas aquí.
type Tab = {
  id: string;
  label: string;
  href: string;
  Icon: (p: SVGProps<SVGSVGElement>) => ReactElement;
  dot?: boolean;
};

const TABS: Tab[] = [
  { id: "home", label: "Inicio", href: "/", Icon: HomeIcon },
  { id: "tickets", label: "Mis entradas", href: "/tickets", Icon: TicketIcon, dot: true },
  { id: "favs", label: "Favoritos", href: "/favorites", Icon: HeartIcon },
  { id: "me", label: "Cuenta", href: "/profile", Icon: UserIcon },
];

function activeId(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/tickets")) return "tickets";
  if (pathname.startsWith("/favorites")) return "favs";
  if (pathname.startsWith("/profile") || pathname.startsWith("/account")) return "me";
  return "";
}

export function UserTabbar() {
  const pathname = usePathname();
  const active = activeId(pathname);
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-[70] block border-t border-cart-line bg-cart-bg/90 px-1 pb-[calc(env(safe-area-inset-bottom,0px)+8px)] pt-2 backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <div className="mx-auto grid max-w-[540px] grid-cols-4">
        {TABS.map(({ id, label, href, Icon, dot }) => {
          const isOn = active === id;
          return (
            <Link
              key={id}
              href={href as never}
              aria-current={isOn ? "page" : undefined}
              className="group relative flex flex-col items-center justify-center gap-1 px-0.5 py-1.5"
            >
              {/* Indicador activo que se desliza entre tabs (layoutId) */}
              {isOn && (
                <motion.span
                  layoutId="tabbar-active"
                  aria-hidden
                  className="absolute -top-2 h-[3px] w-7 rounded-b bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent)]"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              )}

              {/* Ícono en contenedor de tamaño fijo → todos los tabs quedan
                  perfectamente centrados pese a íconos de distinto peso. */}
              <motion.span
                animate={{ scale: isOn ? 1.06 : 1, y: isOn ? -1 : 0 }}
                whileTap={{ scale: 0.86 }}
                transition={{ type: "spring", stiffness: 500, damping: 26 }}
                className={
                  "relative grid size-6 place-items-center transition-colors " +
                  (isOn ? "text-cart-accent" : "text-cart-ink-3 group-hover:text-white")
                }
              >
                <Icon />
                {dot && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-0.5 size-[7px] rounded-full bg-cart-accent shadow-[0_0_6px_var(--color-cart-accent)]"
                  />
                )}
              </motion.span>

              <span
                className={
                  "text-[10.5px] font-medium leading-none transition-colors " +
                  (isOn ? "text-cart-accent" : "text-cart-ink-3")
                }
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

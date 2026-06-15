"use client";

import type { ReactElement, SVGProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { UserAvatar } from "./UserAvatar";
import {
  CompassIcon,
  HeartIcon,
  HomeIcon,
  TicketIcon,
  UserIcon,
} from "@/app/[locale]/_home/icons";

// Navegación lateral de la zona de usuario en desktop (≥lg). En móvil/tablet
// esta navegación vive en el tabbar inferior; aquí aprovechamos el ancho para
// mostrar todas las secciones de un vistazo (inspirado en SeatGeek/Partiful).
type Item = {
  id: string;
  label: string;
  href: string;
  Icon: (p: SVGProps<SVGSVGElement>) => ReactElement;
};

const ITEMS: Item[] = [
  { id: "home", label: "Inicio", href: "/", Icon: HomeIcon },
  { id: "explore", label: "Explorar", href: "/events", Icon: CompassIcon },
  { id: "tickets", label: "Mis entradas", href: "/tickets", Icon: TicketIcon },
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

export function UserSidebar() {
  const pathname = usePathname();
  const active = activeId(pathname);
  const me = useCurrentUser();
  const user = me.data?.user ?? null;
  const name = user?.fullName ?? "Tu cuenta";
  const sub = user?.email ?? user?.phone ?? "";

  return (
    <aside className="hidden lg:block lg:w-[248px] lg:shrink-0">
      <div className="sticky top-[76px] flex flex-col gap-1.5">
        {/* Identidad */}
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev p-3">
          <UserAvatar
            name={user?.fullName ?? user?.email}
            avatarUrl={user?.avatarUrl}
            className="size-10 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
            fallbackClassName="bg-gradient-to-br from-[#7C3AED] to-[#b87cff] text-[14px]"
          />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-white">{name}</p>
            {sub && <p className="truncate text-[12px] text-cart-ink-3">{sub}</p>}
          </div>
        </div>

        {/* Secciones */}
        <nav className="flex flex-col gap-0.5" aria-label="Navegación de cuenta">
          {ITEMS.map(({ id, label, href, Icon }) => {
            const isOn = active === id;
            return (
              <Link
                key={id}
                href={href as never}
                aria-current={isOn ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
                  isOn
                    ? "bg-cart-accent/15 text-white"
                    : "text-cart-ink-2 hover:bg-cart-bg-elev hover:text-white"
                }`}
              >
                <span className={isOn ? "text-cart-accent" : "text-cart-ink-3 group-hover:text-white"}>
                  <Icon />
                </span>
                {label}
                {isOn && (
                  <span
                    aria-hidden
                    className="ml-auto size-1.5 rounded-full bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent)]"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pie */}
        <div className="mt-2 border-t border-cart-line-2 pt-2">
          <Link
            href={"/organizadores" as never}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-cart-ink-3 transition-colors hover:bg-cart-bg-elev hover:text-white"
          >
            Soy organizador
          </Link>
        </div>
      </div>
    </aside>
  );
}

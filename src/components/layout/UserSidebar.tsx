"use client";

import { useEffect, useRef, useState, type ReactElement, type SVGProps } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useSignOut } from "@/lib/identity/hooks/useFirebaseAuth";
import { UserAvatar } from "./UserAvatar";
import {
  HeartIcon,
  HomeIcon,
  TicketIcon,
  UserIcon,
} from "@/app/[locale]/_home/icons";

// Rail lateral de la zona de usuario en desktop (≥lg). Mismo patrón que el panel
// de organizador (OrgShell): rail de altura completa con borde, marca arriba,
// navegación al centro e identidad abajo. En móvil/tablet la navegación vive en
// el tabbar inferior + el header, así que este rail se oculta.
type Item = {
  id: string;
  label: string;
  href: string;
  Icon: (p: SVGProps<SVGSVGElement>) => ReactElement;
};

const ITEMS: Item[] = [
  { id: "home", label: "Inicio", href: "/", Icon: HomeIcon },
  { id: "tickets", label: "Mis entradas", href: "/tickets", Icon: TicketIcon },
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

export function UserSidebar() {
  const pathname = usePathname();
  const active = activeId(pathname);
  const me = useCurrentUser();
  const user = me.data?.user ?? null;
  const name = user?.fullName ?? "Tu cuenta";
  const sub = user?.email ?? user?.phone ?? "";

  return (
    <aside className="sticky top-[68px] hidden h-[calc(100dvh-68px)] w-[248px] shrink-0 flex-col border-r border-cart-line px-3 pb-5 pt-6 lg:flex">
      {/* Secciones (la marca vive en el header superior) */}
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

      <div className="mt-1.5 border-t border-cart-line-2 pt-1.5">
        <Link
          href={"/organizadores" as never}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-cart-ink-3 transition-colors hover:bg-cart-bg-elev hover:text-white"
        >
          Soy organizador
        </Link>
      </div>

      {/* Identidad (abajo): abre un popover con Cuenta / Cerrar sesión */}
      <div className="mt-auto">
        <IdentityPill
          name={name}
          sub={sub}
          fullName={user?.fullName ?? user?.email}
          avatarUrl={user?.avatarUrl}
        />
      </div>
    </aside>
  );
}

function IdentityPill({
  name,
  sub,
  fullName,
  avatarUrl,
}: {
  name: string;
  sub: string;
  fullName: string | null | undefined;
  avatarUrl: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const signOut = useSignOut();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-10 overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev p-1 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)]"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                router.push("/profile" as never);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium text-cart-ink-2 transition-colors hover:bg-cart-bg-elev-2 hover:text-white"
            >
              <UserIcon />
              Cuenta
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium text-rose-300 transition-colors hover:bg-rose-500/10"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4H4v10h7M14 9H7M11 6l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          "flex w-full items-center gap-3 rounded-2xl border bg-cart-bg-elev p-2.5 text-left transition-colors " +
          (open ? "border-cart-line-strong" : "border-cart-line hover:border-cart-line-strong")
        }
      >
        <UserAvatar
          name={fullName}
          avatarUrl={avatarUrl}
          className="size-9 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
          fallbackClassName="bg-gradient-to-br from-[#7C3AED] to-[#b87cff] text-[13px]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-white">{name}</p>
          {sub && <p className="truncate text-[11.5px] text-cart-ink-3">{sub}</p>}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          className={"shrink-0 text-cart-ink-3 transition-transform " + (open ? "rotate-180" : "")}
        >
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

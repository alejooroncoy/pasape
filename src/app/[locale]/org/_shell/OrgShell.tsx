"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMyOrgs } from "@/lib/identity/organizations/hooks/useMyOrgs";
import { AnimatePresence, motion } from "motion/react";
import { OrgSwitcherButton } from "@/components/domain/identity/OrgSwitcherButton";
import { UserPill, initialsOf } from "./UserPill";
import { Logo } from "@/components/brand/Logo";
import { AccountSheet } from "./AccountSheet";

type NavItem = { href: string; label: string; icon: ReactNode };
type NavSection = { header: string | null; items: NavItem[] };

// Estructura del sidebar:
//  · "Esta marca" agrupa todo lo scoped a la marca activa (eventos, reportes,
//    settings de marca). Cuando el usuario cambia el switcher de arriba, este
//    bloque cambia de contexto.
//  · "Tu grupo" es transversal — el equipo y la gente con acceso pueden
//    tener scope a razón social, marca o evento. Vive fuera del scope de marca
//    para que no parezca que "Equipo" sólo aplica a la marca activa.
const NAV_SECTIONS: NavSection[] = [
  {
    header: "Esta marca",
    items: [
      {
        href: "/org",
        label: "Inicio",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
              d="M3 10.5L10 4l7 6.5V16a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1v-5.5z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
      {
        href: "/org/events",
        label: "Eventos",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9h14M7 3v4M13 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: "/org/reports",
        label: "Reportes",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 16V8m4 8V4m4 12v-6m4 6v-9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
      {
        href: "/org/settings",
        label: "Ajustes",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
    ],
  },
  {
    header: "Administración",
    items: [
      {
        href: "/org/team",
        label: "Equipo",
        icon: (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M2 16c.5-2.5 2.5-4 5-4s4.5 1.5 5 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="14" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M12.5 16.5c.3-2.4 2-3.4 4.5-3.4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        ),
      },
    ],
  },
];

// Para retrocompatibilidad — algunos lugares iteran sobre todos los items.
const NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function OrgShell({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const orgs = useMyOrgs();
  const pathname = usePathname() ?? "";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobileNavOpen]);

  const activeOrg = orgs.data?.find((o) => o.slug === me.data?.activeOrgSlug) ?? orgs.data?.[0];
  const user = me.data?.user;
  const userInitials = initialsOf(user?.fullName, user?.email);

  return (
    <div className="home-light home-wash min-h-dvh bg-cart-bg text-cart-ink">

      <div className="relative z-10 mx-auto flex w-full max-w-[1440px]">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-dvh w-[240px] flex-shrink-0 flex-col border-r border-cart-line px-3 py-5 lg:flex">
          <Link
            href={"/org" as never}
            className="mb-3 inline-flex items-center gap-1.5 px-1 text-[11.5px] font-medium tracking-[0.08em] text-cart-ink-3 transition-colors hover:text-cart-ink"
            aria-label="Pasape"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Logo className="size-5 opacity-90" />
            <span className="uppercase">Pasape</span>
          </Link>

          <div className="mb-4">
            <OrgSwitcherButton />
          </div>

          <nav className="flex flex-col gap-5" aria-label="Panel del organizador">
            {NAV_SECTIONS.map((section, sIdx) => (
              <div key={section.header ?? sIdx} className="flex flex-col gap-1">
                {section.header && (
                  <div className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-4">
                    {section.header}
                  </div>
                )}
                {section.items.map((item) => {
                  const isActive =
                    item.href === "/org"
                      ? pathname === `/es/org` || pathname === `/en/org` || pathname.endsWith("/org")
                      : pathname.includes(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href as never}
                      className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "text-cart-ink"
                          : "text-cart-ink-2 hover:bg-cart-bg-elev hover:text-cart-ink"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="org-nav-active"
                          className="absolute inset-0 -z-10 rounded-xl bg-cart-accent-soft shadow-[0_0_0_1px_var(--color-cart-accent-soft)_inset]"
                          transition={{ type: "spring", stiffness: 460, damping: 36 }}
                        />
                      )}
                      <span className={isActive ? "text-cart-accent" : "text-cart-ink-3"}>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="mt-auto">
            <UserPill />
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1">
          {/* Topbar (mobile) */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-cart-line bg-cart-bg/85 px-4 py-3 backdrop-blur-md lg:hidden">
            <motion.button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileNavOpen}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.04 }}
              transition={{ type: "spring", damping: 18, stiffness: 360 }}
              className="grid size-10 place-items-center rounded-full border border-cart-line bg-cart-bg-elev"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <motion.path
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  initial={false}
                  animate={mobileNavOpen ? { d: "M5 5L15 15" } : { d: "M3 6L17 6" }}
                  transition={{ duration: 0.22 }}
                />
                <motion.path
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  initial={false}
                  animate={mobileNavOpen ? { opacity: 0 } : { opacity: 1, d: "M3 10L17 10" }}
                  transition={{ duration: 0.18 }}
                  d="M3 10L17 10"
                />
                <motion.path
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  initial={false}
                  animate={mobileNavOpen ? { d: "M5 15L15 5" } : { d: "M3 14L17 14" }}
                  transition={{ duration: 0.22 }}
                />
              </svg>
            </motion.button>
            <Link href={"/org" as never} className="flex items-center gap-2 text-[15px] font-semibold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Logo className="size-7" />
              <span className="truncate">{activeOrg?.name ?? "Panel"}</span>
            </Link>
            <motion.button
              type="button"
              onClick={() => setAccountOpen(true)}
              aria-label={user ? "Mi cuenta" : "Iniciar sesión"}
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.04 }}
              transition={{ type: "spring", damping: 18, stiffness: 360 }}
              className="ml-auto grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#b87cff] text-[12.5px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
            >
              {user ? (
                userInitials
              ) : (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="M3.5 17c.9-2.8 3.4-4.5 6.5-4.5s5.6 1.7 6.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </motion.button>
          </header>

          <div className="px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">{children}</div>
        </main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 app-scrim lg:hidden"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <motion.aside
              key="drawer-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 360, mass: 0.8 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[86vw] flex-col border-r border-cart-line bg-cart-bg px-3 py-5 shadow-[20px_0_60px_-20px_rgba(0,0,0,0.7)] lg:hidden"
            >
              <div className="mb-4 flex items-center justify-between px-2">
                <Link
                  href={"/org" as never}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-2 text-[17px] font-semibold"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Logo className="size-8" />
                  Pasape
                </Link>
                <motion.button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Cerrar menú"
                  whileTap={{ scale: 0.9 }}
                  whileHover={{ scale: 1.06, rotate: 90 }}
                  transition={{ type: "spring", damping: 18, stiffness: 320 }}
                  className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-ink-2"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3 3l8 8M11 3l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </motion.button>
              </div>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
                }}
                className="flex flex-1 flex-col"
              >
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -10 },
                    visible: { opacity: 1, x: 0, transition: { duration: 0.22 } },
                  }}
                  className="mb-3 px-1"
                >
                  <OrgSwitcherButton />
                </motion.div>
                <nav className="flex flex-col gap-5" aria-label="Panel">
                  {NAV_SECTIONS.map((section, sIdx) => (
                    <div key={section.header ?? sIdx} className="flex flex-col gap-1">
                      {section.header && (
                        <motion.div
                          variants={{
                            hidden: { opacity: 0, x: -10 },
                            visible: { opacity: 1, x: 0, transition: { duration: 0.22 } },
                          }}
                          className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-4"
                        >
                          {section.header}
                        </motion.div>
                      )}
                      {section.items.map((item) => {
                        const isActive =
                          item.href === "/org"
                            ? pathname.endsWith("/org")
                            : pathname.includes(item.href);
                        return (
                          <motion.div
                            key={item.href}
                            variants={{
                              hidden: { opacity: 0, x: -10 },
                              visible: { opacity: 1, x: 0, transition: { duration: 0.22 } },
                            }}
                          >
                            <Link
                              href={item.href as never}
                              onClick={() => setMobileNavOpen(false)}
                              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                                isActive
                                  ? "text-cart-ink"
                                  : "text-cart-ink-2 hover:bg-cart-bg-elev hover:text-cart-ink"
                              }`}
                            >
                              {isActive && (
                                <motion.span
                                  layoutId="org-nav-mobile-active"
                                  className="absolute inset-0 -z-10 rounded-xl bg-cart-accent-soft"
                                  transition={{ type: "spring", stiffness: 460, damping: 36 }}
                                />
                              )}
                              <span className={isActive ? "text-cart-accent" : "text-cart-ink-3"}>
                                {item.icon}
                              </span>
                              {item.label}
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  ))}
                </nav>
                <motion.div
                  variants={{
                    hidden: { opacity: 0, x: -10 },
                    visible: { opacity: 1, x: 0, transition: { duration: 0.22 } },
                  }}
                  className="mt-auto pt-3"
                >
                  <UserPill />
                </motion.div>
              </motion.div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}

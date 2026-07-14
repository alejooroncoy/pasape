"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { PromoterUserPill } from "./PromoterUserPill";
import { Logo } from "@/components/brand/Logo";

export type PromoTab = "home" | "goals" | "earnings" | "profile";

const TABS: Array<{ key: PromoTab; label: string; href: string; icon: ReactNode }> = [
  {
    key: "home",
    label: "Inicio",
    href: "/promo",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path
          d="M3 10l7-6 7 6v7a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1v-7z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "goals",
    label: "Metas",
    href: "/promo/metas",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="0.5" fill="currentColor" stroke="currentColor" />
      </svg>
    ),
  },
  {
    key: "earnings",
    label: "Ganancias",
    href: "/promo/earnings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M3 17V8m4 9V5m4 12v-7m4 7v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "Perfil",
    href: "/promo/profile",
    icon: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 17.5c.4-2.6 3-4.5 7-4.5s6.6 1.9 7 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function PromoterShell({
  active,
  children,
}: {
  active: PromoTab;
  children: ReactNode;
}) {
  return (
    <div className="home-light home-wash min-h-[100dvh] bg-cart-bg text-cart-ink">
      {/* ============ Desktop sidebar ============ */}
      <div className="relative z-10 hidden min-h-[100dvh] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-dvh flex-col border-r border-cart-line bg-cart-bg-elev/50 px-5 py-6">
          <div className="mb-8 flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]">
            <span className="grid size-8 place-items-center overflow-hidden rounded-lg">
              <Logo className="size-full" />
            </span>
            Pasape
            <span className="ml-1 rounded-full bg-cart-accent-soft px-1.5 py-px text-[9.5px] font-bold tracking-[0.12em] text-cart-accent">
              PROMO
            </span>
          </div>

          <nav className="flex flex-col gap-1">
            {TABS.map((t) => {
              const on = t.key === active;
              return (
                <Link
                  key={t.key}
                  href={t.href as never}
                  className={
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition " +
                    (on ? "text-cart-ink" : "text-cart-ink-2 hover:bg-cart-bg-elev hover:text-cart-ink")
                  }
                >
                  {on && (
                    <motion.span
                      layoutId="promo-nav-active"
                      className="absolute inset-0 -z-10 rounded-xl bg-cart-accent-soft"
                      transition={{ type: "spring", stiffness: 460, damping: 36 }}
                    />
                  )}
                  <span className={on ? "text-cart-accent" : "text-cart-ink-3 group-hover:text-cart-ink-2"}>
                    {t.icon}
                  </span>
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto">
            <PromoterUserPill />
          </div>
        </aside>

        <main className="px-8 py-8">
          <div className="mx-auto w-full max-w-[860px]">{children}</div>
        </main>
      </div>

      {/* ============ Mobile ============ */}
      <div className="relative z-10 lg:hidden">
        {/* Header superior: marca + usuario (antes no existía en móvil). */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between border-b border-cart-line bg-cart-bg/95 px-5 py-3 backdrop-blur-md"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <div className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
            <span className="grid size-7 place-items-center overflow-hidden rounded-lg">
              <Logo className="size-full" />
            </span>
            Pasape
            <span className="ml-0.5 rounded-full bg-cart-accent-soft px-1.5 py-px text-[9px] font-bold tracking-[0.12em] text-cart-accent">
              PROMO
            </span>
          </div>
          <PromoterUserPill compact />
        </header>

        <main
          className="mx-auto w-full max-w-[640px] px-5 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}
        >
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-cart-line bg-cart-bg/95 backdrop-blur-md"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6px)" }}
        >
          <div className="mx-auto flex max-w-[640px] items-stretch justify-around px-3 pt-2">
            {TABS.map((t) => {
              const on = t.key === active;
              return (
                <Link
                  key={t.key}
                  href={t.href as never}
                  className={
                    "relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition " +
                    (on ? "text-cart-accent" : "text-cart-ink-3")
                  }
                >
                  {on && (
                    <motion.span
                      layoutId="promo-tab-pill"
                      className="absolute inset-1 -z-10 rounded-lg bg-cart-accent-soft"
                      transition={{ type: "spring", stiffness: 460, damping: 36 }}
                    />
                  )}
                  <span>{t.icon}</span>
                  <span className="text-[10.5px] font-semibold tracking-[0.02em]">{t.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

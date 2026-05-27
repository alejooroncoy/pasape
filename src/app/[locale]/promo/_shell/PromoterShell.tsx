"use client";

import { type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { PromoterUserPill } from "./PromoterUserPill";

export type PromoTab = "home" | "earnings" | "profile";

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
    <div className="min-h-[100dvh] bg-cart-bg text-white">
      {/* ============ Desktop sidebar ============ */}
      <div className="hidden min-h-[100dvh] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-dvh flex-col border-r border-cart-line bg-cart-bg-elev/50 px-5 py-6">
          <div className="mb-8 flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]">
            <span className="grid size-8 place-items-center overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/logo-icon-min.svg" alt="" className="size-full object-contain" />
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
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition " +
                    (on
                      ? "bg-cart-accent-soft text-white"
                      : "text-cart-ink-2 hover:bg-white/[0.04] hover:text-white")
                  }
                >
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
      <div className="lg:hidden">
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
                    "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition " +
                    (on ? "text-cart-accent" : "text-cart-ink-3")
                  }
                >
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

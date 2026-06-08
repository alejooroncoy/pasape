"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { OrgShell } from "../_shell/OrgShell";
import { useMyEvents } from "@/lib/events/hooks/useEvents";
import type { Event } from "@/server/events/domain/Event";
import { EventCard, EventCardSkeleton } from "./_components/EventCard";
import { EmptyState } from "./_components/EmptyState";

type TabKey = "upcoming" | "past" | "draft";

const TABS: { key: TabKey; label: string }[] = [
  { key: "upcoming", label: "Próximos" },
  { key: "past", label: "Pasados" },
  { key: "draft", label: "Borradores" },
];

function classifyEvent(ev: Event): TabKey {
  if (ev.status === "draft") return "draft";
  if (ev.status === "closed" || ev.status === "cancelled") return "past";
  return "upcoming";
}

export default function OrgEventsPage() {
  const events = useMyEvents();
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Cmd+K to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const all = events.data ?? [];
    const byTab = all.filter((ev) => classifyEvent(ev) === tab);
    const q = search.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((ev) => ev.title.toLowerCase().includes(q));
  }, [events.data, tab, search]);

  const counts = useMemo(() => {
    const all = events.data ?? [];
    return {
      upcoming: all.filter((e) => classifyEvent(e) === "upcoming").length,
      past: all.filter((e) => classifyEvent(e) === "past").length,
      draft: all.filter((e) => classifyEvent(e) === "draft").length,
    };
  }, [events.data]);

  return (
    <OrgShell>
      {/* Header — iOS large title on mobile */}
      <div className="mb-5 flex flex-col gap-4 pt-2 sm:mb-6 sm:pt-0 lg:mb-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start justify-between gap-3 lg:min-w-0 lg:block">
          <div className="min-w-0">
            <h1 className="text-[34px] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-[26px] sm:font-semibold sm:tracking-[-0.02em] lg:text-[30px]">
              Eventos
            </h1>
            <p className="mt-1.5 text-[15px] leading-snug text-cart-ink-3 sm:mt-1 sm:text-[13px]">
              Gestiona los eventos de tu marca.
            </p>
          </div>

          {/* Mobile-only inline + button (iOS nav style) */}
          <Link
            href={"/org/events/new" as never}
            aria-label="Crear evento"
            className="inline-flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-cart-accent text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow)] active:scale-95 transition-transform lg:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 3v12M3 9h12"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </Link>
        </div>

        <div className="flex flex-1 items-center gap-3 lg:max-w-2xl lg:justify-end">
          {/* iOS-style search bar */}
          <motion.div
            animate={{
              boxShadow: searchFocused
                ? "0 0 0 3px var(--color-cart-accent-soft), 0 0 24px -4px var(--color-cart-accent-glow)"
                : "0 0 0 0px transparent",
              borderColor: searchFocused
                ? "var(--color-cart-accent)"
                : "var(--color-cart-line)",
            }}
            transition={{ duration: 0.18 }}
            className="relative flex flex-1 items-center rounded-2xl border bg-cart-bg-elev sm:rounded-xl lg:max-w-md"
          >
            <span className="pointer-events-none absolute left-3.5 grid place-items-center text-cart-ink-3 sm:left-3">
              <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M11 11l3 3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Buscar eventos"
              className="w-full bg-transparent py-3 pl-10 pr-3 text-[15px] text-white placeholder:text-cart-ink-4 focus:outline-none sm:py-2.5 sm:pl-9 sm:pr-16 sm:text-[13.5px]"
            />
            <kbd className="pointer-events-none absolute right-3 hidden items-center gap-0.5 rounded-md border border-cart-line bg-cart-bg px-1.5 py-0.5 text-[10px] font-medium text-cart-ink-3 sm:inline-flex">
              ⌘K
            </kbd>
          </motion.div>

          {/* Desktop-only "Crear evento" CTA */}
          <Link
            href={"/org/events/new" as never}
            className="hidden flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-cart-accent px-4 py-2.5 text-[13.5px] font-medium text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow)] transition-transform hover:scale-[1.03] lg:inline-flex"
          >
            <span className="text-[15px] leading-none">+</span>
            <span>Crear evento</span>
          </Link>
        </div>
      </div>

      {/* Tabs — iOS Segmented Control on mobile, underline on desktop */}
      <div className="mb-5 sm:mb-6">
        {/* Mobile: segmented control */}
        <div
          role="tablist"
          aria-label="Filtrar eventos"
          className="relative flex w-full items-center gap-1 rounded-xl bg-white/[0.06] p-1 sm:hidden"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold transition-colors ${
                  active ? "text-white" : "text-cart-ink-3"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="org-events-segment-bg"
                    className="absolute inset-0 rounded-lg bg-cart-bg-elev shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4),inset_0_0_0_1px_var(--color-cart-line)]"
                    transition={{ type: "spring", damping: 28, stiffness: 380 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
                <span
                  className={`relative z-10 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    active
                      ? "bg-cart-accent-soft text-cart-accent"
                      : "bg-white/5 text-cart-ink-4"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop: underline tabs */}
        <div className="-mx-4 hidden overflow-x-auto px-4 sm:mx-0 sm:block sm:px-0">
          <div
            role="tablist"
            aria-label="Filtrar eventos"
            className="relative flex min-w-max items-center gap-1 border-b border-cart-line lg:gap-2"
          >
            {TABS.map((t) => {
              const active = tab === t.key;
              const count = counts[t.key];
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={`relative flex items-center gap-2 px-3 py-2.5 text-[13.5px] font-medium transition-colors lg:px-4 ${
                    active ? "text-white" : "text-cart-ink-3 hover:text-cart-ink-2"
                  }`}
                >
                  {t.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-medium ${
                      active
                        ? "bg-cart-accent-soft text-cart-accent"
                        : "bg-white/5 text-cart-ink-4"
                    }`}
                  >
                    {count}
                  </span>
                  {active && (
                    <motion.span
                      layoutId="org-events-tab-underline"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-cart-accent"
                      transition={{ type: "spring", damping: 28, stiffness: 360 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid / States */}
      <div className="pb-[max(env(safe-area-inset-bottom),1rem)]">
        <AnimatePresence mode="wait">
          {events.isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-3"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key={`empty-${tab}-${search}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1"
            >
              {search.trim() ? (
                <div className="mx-auto max-w-md py-12 text-center">
                  <p className="text-[14px] text-cart-ink-2">
                    Sin resultados para{" "}
                    <span className="font-medium text-white">“{search}”</span>
                  </p>
                  <p className="mt-1 text-[12.5px] text-cart-ink-4">
                    Prueba con otro término o cambia de pestaña.
                  </p>
                </div>
              ) : (
                <EmptyState variant={tab} />
              )}
            </motion.div>
          ) : (
            <motion.div
              key={`grid-${tab}`}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.04 } },
              }}
              className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-3"
            >
              {filtered.map((ev) => (
                <motion.div
                  key={ev.id}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.28, ease: "easeOut" },
                    },
                  }}
                >
                  <EventCard event={ev} variant={tab} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OrgShell>
  );
}

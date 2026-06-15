"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CaretIcon,
  CloseIcon,
  HeartIcon,
  PinIcon,
  SearchIcon,
  TicketIcon,
  WaIcon,
} from "./icons";
import { MegaMenu } from "./MegaMenu";
import { CATEGORIES, CATEGORY_BY_ID } from "./categories";
import { WA_HREF } from "./wa";
import type { EventCategory } from "@/server/events/domain/Event";

type NavProps = {
  onOpenDrawer: () => void;
  onOpenSignIn: () => void;
  onSearch: (q: string) => void;
  onSelectCategory: (cat: EventCategory | null) => void;
  selectedCategory: EventCategory | null;
};

export function Nav({ onOpenDrawer, onOpenSignIn, onSearch, onSelectCategory, selectedCategory }: NavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    document.addEventListener("scroll", onScroll, { passive: true });
    return () => document.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!megaOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMegaOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [megaOpen]);

  // ⌘K / Ctrl+K → focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("input[data-cart-search]")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md backdrop-saturate-150 border-b transition-[border-color,background] duration-200 ${
        scrolled
          ? "border-cart-line bg-cart-bg/[0.92]"
          : "border-transparent bg-cart-bg/80"
      }`}
    >
      {/* Utility row */}
      <div className="border-b border-cart-line-2">
        <div className="mx-auto flex h-9 max-w-[1320px] items-center justify-between gap-4 px-[clamp(20px,4vw,56px)] text-[12.5px] text-cart-ink-3">
          <div className="flex items-center gap-[18px]">
            <a
              href="#"
              className="inline-flex items-center gap-1.5 rounded-full border border-cart-line bg-cart-bg-elev px-2.5 py-1 text-[12.5px] font-medium text-cart-ink-2 hover:border-cart-line-strong"
            >
              <PinIcon className="text-cart-accent" />
              Lima
              <CaretIcon />
            </a>
          </div>
          <div className="hidden items-center gap-[18px] sm:flex">
            <Link href="/organizadores" className="whitespace-nowrap transition-colors hover:text-white">
              Para organizadores
            </Link>
            <span className="size-0.5 rounded-full bg-cart-ink-4" aria-hidden />
            <a href="#" className="whitespace-nowrap transition-colors hover:text-white">
              Ayuda
            </a>
            <span className="size-0.5 rounded-full bg-cart-ink-4" aria-hidden />
            <button
              type="button"
              onClick={onOpenSignIn}
              className="whitespace-nowrap transition-colors hover:text-white"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Main row */}
      <div className="mx-auto grid h-[68px] max-w-[1320px] grid-cols-[auto_auto_1fr_auto] items-center gap-[18px] px-[clamp(20px,4vw,56px)] max-[900px]:grid-cols-[auto_1fr_auto] max-[560px]:h-[60px] max-[560px]:gap-2">
        <Link href="/" className="inline-flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.01em] max-[560px]:text-[0]">
          <span className="grid size-[40px] place-items-center max-[560px]:size-9">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/logo-icon-min.svg"
              alt="Pasape"
              className="size-full object-contain drop-shadow-[0_2px_10px_rgba(184,124,255,0.35)]"
            />
          </span>
          <span className="max-[560px]:sr-only">Pasape</span>
        </Link>

        <button
          type="button"
          aria-expanded={megaOpen}
          aria-controls="cart-mega"
          onClick={(e) => {
            e.stopPropagation();
            setMegaOpen((v) => !v);
          }}
          className={`hidden items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[14.5px] font-medium transition-colors max-[900px]:hidden lg:inline-flex ${
            megaOpen
              ? "border-cart-line bg-cart-bg-elev text-white"
              : "border-transparent text-cart-ink-2 hover:border-cart-line hover:bg-cart-bg-elev hover:text-white"
          }`}
        >
          Categorías
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className={`opacity-70 transition-transform duration-200 ${megaOpen ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path
              d="M2 4l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <label className="flex h-[42px] w-full max-w-[480px] items-center gap-2.5 justify-self-center rounded-full border border-cart-line bg-cart-bg-elev px-3.5 transition-colors focus-within:border-cart-accent focus-within:shadow-[0_0_0_4px_var(--color-cart-accent-soft),0_0_18px_var(--color-cart-accent-glow)] max-[560px]:h-10 max-[560px]:max-w-none max-[560px]:px-3 max-[560px]:gap-2">
          <SearchIcon className="shrink-0 text-cart-ink-4" />
          <input
            data-cart-search
            type="search"
            placeholder="Buscar eventos, artistas, lugares…"
            aria-label="Buscar eventos"
            className="min-w-0 flex-1 border-0 bg-transparent text-[14.5px] text-white outline-none placeholder:text-cart-ink-4 max-[560px]:text-sm"
            onChange={(e) => onSearch(e.target.value)}
          />
          <kbd className="shrink-0 rounded-md border border-cart-line bg-cart-bg-elev-2 px-1.5 py-0.5 font-mono text-[11px] text-cart-ink-3 max-[560px]:hidden">
            ⌘K
          </kbd>
        </label>

        <div className="flex items-center gap-2.5 max-[560px]:gap-0">
          <button
            type="button"
            aria-label="Favoritos"
            onClick={onOpenSignIn}
            className="relative grid size-10 place-items-center rounded-full border border-transparent text-cart-ink-2 transition-colors hover:border-cart-line hover:bg-cart-bg-elev hover:text-white max-[560px]:hidden"
          >
            <HeartIcon />
          </button>
          <button
            type="button"
            aria-label="Mis entradas"
            onClick={onOpenSignIn}
            className="relative inline-flex h-10 items-center gap-2 rounded-full border border-cart-line bg-transparent px-3.5 text-sm font-medium text-cart-ink-2 transition-colors hover:border-cart-line-strong hover:text-white max-[1180px]:px-2 max-[1180px]:w-10 max-[1180px]:justify-center max-[900px]:hidden"
          >
            <TicketIcon />
            <span className="max-[1180px]:hidden">Mis entradas</span>
          </button>
          <a
            href={WA_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border-0 bg-cart-accent px-[18px] py-2.5 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_6px_22px_-6px_var(--color-cart-accent-glow-strong)] transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110 max-[900px]:hidden"
          >
            <WaIcon />
            WhatsApp
          </a>
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Menú"
            className="hidden size-10 place-items-center rounded-full border border-cart-line bg-cart-bg-elev max-[900px]:grid"
          >
            <span className="block h-px w-4 bg-cart-ink-2 relative before:absolute before:top-[-5px] before:block before:h-px before:w-4 before:bg-cart-ink-2 before:content-[''] after:absolute after:top-[5px] after:block after:h-px after:w-4 after:bg-cart-ink-2 after:content-['']" />
          </button>
        </div>
      </div>

      <MobileContextStrip selectedCategory={selectedCategory} onSelectCategory={onSelectCategory} />
      <MegaMenu open={megaOpen} onClose={() => setMegaOpen(false)} onSelectCategory={onSelectCategory} />
    </header>
  );
}

type StripChip = { label: string; cat: EventCategory | null };

const STRIP_CHIPS: StripChip[] = [
  { label: "Todos", cat: null },
  ...CATEGORIES.map((c) => ({ label: c.label, cat: c.id })),
];

function MobileContextStrip({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: EventCategory | null;
  onSelectCategory: (cat: EventCategory | null) => void;
}) {
  return (
    <div
      className="hidden items-center gap-2 overflow-x-auto border-t border-cart-line-2 px-[clamp(20px,4vw,56px)] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[560px]:flex"
      aria-label="Filtros rápidos"
    >
      <a
        href="#"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cart-line bg-cart-bg-elev px-2.5 py-1.5 text-[12.5px] font-medium text-cart-ink-2"
        aria-label="Cambiar ciudad"
      >
        <PinIcon className="text-cart-accent" />
        Lima
      </a>
      <span className="h-4 w-px shrink-0 bg-cart-line" aria-hidden />
      {STRIP_CHIPS.map(({ label, cat }) => {
        const active = selectedCategory === cat;
        const color = cat ? CATEGORY_BY_ID[cat].color : "#ffffff";
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelectCategory(cat)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] whitespace-nowrap transition-colors"
            style={
              active
                ? {
                    borderColor: color,
                    background: color,
                    color: cat ? "#0a0a0f" : "#0a0a0f",
                    boxShadow: `0 0 12px ${color}80`,
                  }
                : {
                    borderColor: "var(--color-cart-line)",
                    background: "transparent",
                    color: "var(--color-cart-ink-2)",
                  }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

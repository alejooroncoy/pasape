"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Icon } from "./icons";
import { Logo } from "./logo";

const LINKS = [
  { href: "#promos", label: "Funciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#piloto", label: "Piloto" },
  { href: "#precio", label: "Precio" },
  { href: "#faq", label: "FAQ" },
];

export function Nav(_props: { waHref?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => firstLinkRef.current?.focus(), 200);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      burgerRef.current?.focus();
    };
  }, [menuOpen]);

  // Polyfill: si el browser no soporta scroll-driven animations (Firefox, Safari < 17)
  // emulamos el efecto de nav-darken con un listener de scroll que muta style directo.
  useEffect(() => {
    if (CSS.supports?.("animation-timeline", "scroll()")) return;
    const el = headerRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const range = window.innerHeight * 0.5;
      const p = Math.min(1, Math.max(0, window.scrollY / range));
      el.style.backgroundColor = `rgba(10, 10, 15, ${(0.92 * p).toFixed(3)})`;
      el.style.borderBottomColor = `rgba(255, 255, 255, ${(0.08 * p).toFixed(3)})`;
      if (p > 0) {
        const f = `saturate(${(100 + 80 * p).toFixed(0)}%) blur(${(16 * p).toFixed(1)}px)`;
        el.style.backdropFilter = f;
        el.style.setProperty("-webkit-backdrop-filter", f);
      } else {
        el.style.backdropFilter = "";
        el.style.removeProperty("-webkit-backdrop-filter");
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
    update();
    document.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className="nav-darken fixed inset-x-0 top-0 z-50 border-b border-transparent"
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1160px] items-center justify-between px-[22px] md:px-8">
        <Logo />
        <nav
          className="hidden items-center gap-7 text-sm font-medium text-ink-3 lg:inline-flex"
          aria-label="Principal"
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative py-1 transition-colors hover:text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-200 hover:after:scale-x-100"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-4 lg:inline-flex">
          {/* Ver eventos como text link sutil — secundario */}
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 transition-colors hover:text-ink"
          >
            Ver eventos
            <Icon
              name="arrow-up-right"
              width={13}
              height={13}
              className="transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px"
            />
          </Link>
          {/* Ingresar al panel — CTA primario para organizadores */}
          <Button
            href="/es/org"
            aria-label="Ingresar al panel de organizador"
            className="px-[18px] py-2.5 text-sm"
          >
            Ingresar
          </Button>
        </div>
        <button
          type="button"
          ref={burgerRef}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          aria-controls="mobile-drawer"
          onClick={() => setMenuOpen((v) => !v)}
          className={`nav-burger lg:hidden ${menuOpen ? "open" : ""}`}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div
        className={`nav-scrim ${menuOpen ? "in" : ""}`}
        aria-hidden={!menuOpen}
        onClick={() => setMenuOpen(false)}
      />
      <aside
        id="mobile-drawer"
        className={`nav-drawer ${menuOpen ? "in" : ""}`}
        aria-hidden={!menuOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
      >
        <div className="flex items-center justify-between border-b border-line pb-[22px]">
          <Logo />
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
            className="inline-grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-2 transition-[background-color,color] duration-150 hover:bg-line hover:text-ink"
          >
            <Icon name="close" width={20} height={20} />
          </button>
        </div>
        <nav className="nav-drawer-links" aria-label="Secciones">
          {LINKS.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              ref={i === 0 ? firstLinkRef : undefined}
              onClick={() => setMenuOpen(false)}
              style={{
                transitionDelay: menuOpen ? `${120 + i * 40}ms` : "0ms",
              }}
            >
              <span className="ndl-num">{String(i + 1).padStart(2, "0")}</span>
              <span>{l.label}</span>
              <span className="ndl-arrow">
                <Icon name="arrow-up-right" width={16} height={16} />
              </span>
            </a>
          ))}
        </nav>
        <div className="nav-drawer-foot flex flex-col gap-2.5">
          <Button
            href="/es/org"
            onClick={() => setMenuOpen(false)}
            className="w-full justify-center px-[18px] py-3.5 text-[15px]"
          >
            Ingresar al panel
          </Button>
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="block w-full px-[18px] py-2 text-center text-sm font-medium text-ink-3 transition-colors hover:text-ink"
          >
            Ver eventos →
          </Link>
        </div>
      </aside>
    </header>
  );
}

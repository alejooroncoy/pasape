"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export type Section = { id: string; label: string };

type Props = { sections: Section[] };

export function SectionNav({ sections }: Props) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  // Cuando el usuario clickea un chip, deshabilitamos el scroll-spy durante
  // el smooth scroll para que no sobrescriba el activo (especialmente importante
  // en la última sección, que no puede empujar su top sobre el offset).
  const isJumping = useRef(false);
  const jumpTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = () => {
      if (isJumping.current) return;
      const offset = 140;
      let current = sections[0]?.id ?? "";
      let bestDelta = Number.POSITIVE_INFINITY;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - offset;
        if (top <= 0 && Math.abs(top) < bestDelta) {
          current = s.id;
          bestDelta = Math.abs(top);
        }
      }
      // Si llegamos al fondo de la página, fuerza la última sección como activa.
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 32;
      if (nearBottom) current = sections[sections.length - 1]?.id ?? current;
      setActive(current);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [sections]);

  const onJump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    isJumping.current = true;
    if (jumpTimeoutRef.current) window.clearTimeout(jumpTimeoutRef.current);
    const y = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: y, behavior: "smooth" });
    jumpTimeoutRef.current = window.setTimeout(() => {
      isJumping.current = false;
    }, 700);
  };

  return (
    <>
      {/* Desktop rail */}
      <aside className="sticky top-6 hidden h-fit w-[200px] flex-shrink-0 lg:block">
        <nav className="flex flex-col gap-1" aria-label="Secciones de configuración">
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onJump(s.id)}
                className="relative rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-cart-ink-2 transition-colors hover:text-white"
              >
                {isActive && (
                  <motion.span
                    layoutId="settings-rail-active"
                    className="absolute inset-0 rounded-lg bg-cart-accent-soft"
                    transition={{ type: "spring", stiffness: 460, damping: 36 }}
                  />
                )}
                <span className={`relative ${isActive ? "text-white" : ""}`}>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile: iOS Segmented Control — pill container, sliding highlight */}
      <div className="sticky top-[57px] z-20 -mx-4 mb-5 bg-cart-bg/85 px-4 pb-2 pt-1 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
        <div
          role="tablist"
          aria-label="Secciones de configuración"
          className="no-scrollbar relative flex w-full gap-0.5 overflow-x-auto rounded-full border border-cart-line bg-cart-bg-elev/80 p-1"
        >
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => onJump(s.id)}
                className={`relative flex-shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  isActive ? "text-white" : "text-cart-ink-3 hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="settings-chip-active"
                    className="absolute inset-0 -z-10 rounded-full bg-cart-accent-soft shadow-[inset_0_0_0_1px_var(--color-cart-line-strong)]"
                    transition={{ type: "spring", stiffness: 460, damping: 36 }}
                  />
                )}
                <span className="relative whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

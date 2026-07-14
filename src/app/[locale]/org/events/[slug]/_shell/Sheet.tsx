"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";

// Nota: el Sheet SIEMPRE se monta client-only (picker/personalize por interacción,
// y RequestsDrawer gatea con `mounted`), así que leer window aquí en el
// inicializador es seguro — ningún camino SSR-ea el Sheet. Eso da el breakpoint
// correcto desde el primer render (sin parpadeo móvil→desktop del drawer).
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

/** Panel lateral en desktop, drawer deslizable en móvil — mismo componente. */
export function Sheet({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (isDesktop) {
    return (
      <>
        <motion.div
          key="bd-desktop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-hidden
          className="fixed inset-0 z-80 app-scrim"
        />
        <motion.div
          key="sh-desktop"
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 34, stiffness: 380 }}
          className="fixed right-0 top-0 z-81 flex h-dvh w-full max-w-[520px] flex-col border-l border-cart-line-strong bg-cart-bg-elev shadow-[-20px_0_60px_-10px_rgba(0,0,0,0.7)]"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cart-line bg-cart-bg-elev/95 px-6 py-4 backdrop-blur">
            <h3 className="font-sans text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="grid size-8 place-items-center rounded-full text-cart-ink-3 transition hover:bg-cart-ink/5 hover:text-cart-ink"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      <motion.div
        key="bd-mobile"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-80 app-scrim"
      />
      <motion.div
        key="sh-mobile"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 360 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 140 || info.velocity.y > 700) onClose();
        }}
        className="fixed inset-x-0 bottom-0 z-81 mx-auto max-h-[88dvh] w-full max-w-[560px] touch-none overflow-y-auto rounded-t-[28px] border-t border-cart-line-strong bg-cart-bg-elev shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
      >
        <div className="sticky top-0 z-10 -mx-px flex flex-col bg-cart-bg-elev/95 px-5 pt-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-cart-ink/15" />
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] font-semibold text-cart-accent"
            >
              Cerrar
            </button>
          </div>
        </div>
        <div className="px-5">{children}</div>
      </motion.div>
    </>
  );
}

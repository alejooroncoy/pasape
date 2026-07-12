"use client";

// Shell del pago que "CRECE" desde la hoja de datos hasta ocupar toda la
// pantalla — no un salto de página. El truco para que se lea como "la misma
// hoja creció" (y no "subió otra página"): el contenedor arranca clonando la
// geometría de reposo de la hoja (anclado abajo, mismo ancho, radio superior) y
// crece desde ahí; el scrim profundiza para señalar "contexto de pago, foco".
//
// Es la plomería visual: lo usa el intercept (@modal/(.)buy) como overlay y la
// ruta /buy como fallback. El contenido de pago va como children — que reciben
// `arrived` para montar los campos de Mercado Pago SOLO cuando la subida asentó
// (los SecureFields se rompen si se montan dentro de un contenedor que aún anima
// su transform/height). Cierre = espejo exacto: baja y encoge a hoja, y recién
// al terminar dispara `onClosed` (navegación).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// Arranca como bottom-sheet (~84% de alto) y crece a fullscreen. La hoja de
// datos se cierra al navegar, así que no hay nada que revelar por arriba; el
// scrim (ya a 30% desde el frame 0) cubre ese cierre.
const SHEET_TOP = "16dvh";
const GROW_MS = 0.44;
const EASE = [0.22, 1, 0.36, 1] as const;

type ChildOpts = { arrived: boolean; requestClose: () => void };

export function PayDrawer({
  onClosed,
  title,
  children,
}: {
  /** Se dispara al terminar la animación de SALIDA (navegación va acá). */
  onClosed: () => void;
  /** Título de la superficie (ej. "Pago"). */
  title: string;
  children: (opts: ChildOpts) => ReactNode;
}) {
  const reduce = useReducedMotion();
  // Mount-guard: motion + matchMedia dentro → evita mismatch de hidratación.
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);
  const [arrived, setArrived] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // Escape cierra (con la salida animada).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false); // dispara exit → onExitComplete → onClosed
  };

  if (!mounted) return null;

  return (
    <AnimatePresence onExitComplete={onClosed}>
      {open && (
        <div className="home-light fixed inset-0 z-[95]">
          {/* Scrim que PROFUNDIZA: de claro (contexto normal) a oscuro (foco de
              pago). Tocar fuera del área de pago cierra. */}
          <motion.div
            className="absolute inset-0"
            initial={{ backgroundColor: "rgba(20,15,40,0.30)" }}
            animate={{ backgroundColor: "rgba(12,8,28,0.62)" }}
            exit={{ backgroundColor: "rgba(20,15,40,0)" }}
            transition={{ duration: GROW_MS, ease: EASE }}
            onClick={requestClose}
          />

          {/* La superficie que crece. Fija abajo; animar `top` de 22dvh→0 hace
              crecer el alto desde la hoja hasta fullscreen. En reduced-motion no
              hay movimiento: arranca ya a pantalla completa y solo cruza opacidad. */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[560px] flex-col overflow-hidden border-t border-cart-line bg-cart-bg text-cart-ink shadow-[0_-20px_60px_-24px_rgba(20,10,60,0.5)]"
            initial={
              reduce
                ? { top: "0dvh", opacity: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }
                : { top: SHEET_TOP, opacity: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26 }
            }
            animate={
              reduce
                ? { top: "0dvh", opacity: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 }
                : { top: "0dvh", opacity: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0 }
            }
            exit={
              reduce
                ? { opacity: 0 }
                : { top: SHEET_TOP, opacity: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26 }
            }
            transition={{ duration: reduce ? 0.18 : GROW_MS, ease: EASE }}
            onAnimationComplete={() => setArrived(true)}
          >
            {/* Asa: visible al arrancar (era una hoja), se desvanece al crecer. */}
            {!reduce && (
              <motion.div
                aria-hidden
                className="flex shrink-0 justify-center pt-2.5"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
              >
                <div className="h-1.5 w-9 rounded-full bg-cart-line-strong" />
              </motion.div>
            )}

            {/* Header: cerrar (aparece al asentar, ya no se arrastra) + título +
                TOTAL anclado arriba-derecha (mismo lugar que en la hoja → ancla
                visual, el ojo mantiene un punto fijo mientras todo crece). */}
            <div
              className="flex shrink-0 items-center gap-3 px-5 pb-3"
              style={{ paddingTop: reduce ? "max(env(safe-area-inset-top,0px),14px)" : "6px" }}
            >
              <motion.button
                type="button"
                onClick={requestClose}
                aria-label="Cerrar"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-cart-ink"
                initial={{ opacity: 0 }}
                animate={{ opacity: arrived ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </motion.button>
              <span className="text-[15px] font-bold tracking-[-0.01em]">{title}</span>
            </div>

            {/* Cuerpo scrolleable con el contenido de pago. */}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-8">
              {children({ arrived, requestClose })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Entrada escalonada de un bloque de contenido de pago. Cada bloque sube+aparece
 * con un pequeño desfase → "ensamblado con intención", no un bloque que aparece
 * de golpe (que se ve genérico). Usar `index` para el orden del stagger.
 */
export function PayReveal({
  index = 0,
  children,
  className,
}: {
  index?: number;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: "easeOut", delay: reduce ? 0 : 0.18 + index * 0.05 }}
    >
      {children}
    </motion.div>
  );
}

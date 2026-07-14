"use client";

// Primitivo ÚNICO de hoja/modal del lado consumidor. Todos los drawers del fan
// (login, datos de checkout, menú, compartir) deben montar sobre este — no
// reimplementar portal + motion + scrim + sombra a mano, que es lo que hacía que
// derivaran (una hoja clara con sombra negra de tema oscuro, otra con overlay
// distinto…). Un solo lugar → un solo comportamiento.
//
//   - Radix Dialog aporta lo difícil de a11y: focus-trap, scroll-lock, Escape,
//     cierre al tocar fuera, aria-modal. No lo reimplementamos.
//   - motion aporta el slide-in + drag-to-dismiss (Radix no anima).
//   - `home-light` en overlay y content: los tokens --color-cart-* claros se
//     heredan aquí aunque el portal cuelgue de <body> (fuera del scope de la
//     página). Cambiar la paleta en globals.css se propaga a TODAS las hojas.
//   - `app-scrim`: el mismo velo centralizado de todo el sistema.
//   - Responsive: bottom-sheet en móvil, modal centrado en desktop.
//
// El drag arranca SOLO desde el asa (dragListener={false} + dragControls), así
// el cuerpo puede scrollear sin pelear con el gesto de arrastre.

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Requerido por a11y (Radix exige un Title). Se lee por lectores de pantalla. */
  title: string;
  /** Descripción para lectores de pantalla (opcional). */
  description?: string;
  children: ReactNode;
  /** CTA/pie fijo que no scrollea (ej. botón de pagar). */
  footer?: ReactNode;
  /** Ancho máximo del modal en desktop (px). */
  maxWidth?: number;
  /** Acento del asa/detalles (por defecto el token de acento). */
  className?: string;
  /**
   * Modo "hoja que CRECE a pantalla completa" (checkout: datos → pago). Es la
   * MISMA hoja (no cierra una y abre otra): animamos su alto desde su tamaño
   * actual hasta 100dvh y el radio superior a 0. Al terminar, `onExpandComplete`
   * — el consumidor monta ahí el contenido frágil (campos MP) recién cuando el
   * crecimiento asentó, no durante el transform. El asa se oculta.
   */
  expanded?: boolean;
  /** Se dispara cuando la animación de crecimiento terminó (alto ya = 100dvh). */
  onExpandComplete?: () => void;
};

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = 420,
  className,
  expanded = false,
  onExpandComplete,
}: Props) {
  const dragControls = useDragControls();

  // Crecimiento determinista: al pasar a `expanded`, fijamos el alto actual (px)
  // y en el siguiente frame lo animamos a innerHeight. Ir de "auto"→px→100dvh
  // evita el salto que daría animar desde un alto content-driven. Cuando no está
  // expandida no tocamos el alto (queda content-driven con max-h). Ver Plan A.
  // El crecimiento a pantalla completa es un patrón MÓVIL. En desktop (≥lg) la
  // hoja expandida se queda como MODAL centrado normal (sin height:100dvh, con
  // esquinas redondeadas) — más simple y natural en pantalla grande.
  // Init lazy con el valor real: el primer render ya sabe si es desktop, así una
  // hoja que monta abierta (deep-link) entra con el fade/scale correcto y no con
  // el slide móvil de un frame. En SSR no hay window (la hoja monta cerrada).
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const growFull = expanded && !isDesktop;

  const contentRef = useRef<HTMLDivElement>(null);
  const targetHRef = useRef(0);
  const wasExpandedRef = useRef(false);
  const [grownH, setGrownH] = useState<number | "auto" | null>(null);
  useLayoutEffect(() => {
    if (!growFull) {
      // Colapso ANIMADO: si veníamos de pantalla completa (X → volver a datos),
      // animamos el alto de vuelta a "auto" (framer mide el contenido de datos)
      // en vez de saltar. Si nunca creció (o es desktop), no controlamos el alto.
      setGrownH(wasExpandedRef.current ? "auto" : null);
      wasExpandedRef.current = false;
      return;
    }
    wasExpandedRef.current = true;
    const cur = contentRef.current?.getBoundingClientRect().height ?? 0;
    setGrownH(cur); // arranca clonando el alto actual (sin salto)
    targetHRef.current = window.innerHeight;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setGrownH(targetHRef.current)),
    );
    return () => cancelAnimationFrame(id);
  }, [growFull]);

  // Desktop: no hay animación de crecimiento que esperar → avisamos "asentado"
  // de una vez para que el consumidor monte el contenido (campos MP) sin demora.
  useEffect(() => {
    if (expanded && isDesktop) onExpandComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, isDesktop]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Velo: mismo scrim central. `home-light` para que los tokens
                claros valgan dentro del portal. Radix cierra al tocarlo. */}
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                // Mismo tiempo/easing que la hoja: velo y hoja salen en bloque
                // (si el velo se va antes, la hoja queda deslizándose sola y se
                // ve "entrecortado").
                transition={{ duration: 0.3, ease: [0.42, 0, 0.58, 1] }}
                className="home-light fixed inset-0 z-[90] app-scrim"
              />
            </Dialog.Overlay>

            {/* Contenedor de posición (bottom en móvil, centro en desktop). No
                captura clicks salvo la hoja: Radix cierra al tocar fuera. Solo
                el crecimiento móvil (`growFull`) se ancla abajo a pantalla
                completa; en desktop queda centrado (modal) aun expandida. */}
            <div
              className={
                "home-light pointer-events-none fixed inset-0 z-[91] flex justify-center " +
                (growFull ? "items-end" : "items-end lg:items-center lg:p-6")
              }
            >
              <Dialog.Content asChild forceMount>
                <motion.div
                  ref={contentRef}
                  // Móvil = bottom-sheet: entra/sale deslizando en Y. Desktop =
                  // modal centrado: entra/sale con opacity + scale (fade), NO con
                  // el slide vertical largo — ese viaje se veía entrecortado.
                  initial={isDesktop ? { opacity: 0, scale: 0.97 } : { y: "100%" }}
                  animate={
                    growFull
                      ? { y: 0, height: grownH ?? undefined, borderTopLeftRadius: 0, borderTopRightRadius: 0 }
                      : isDesktop
                        ? { opacity: 1, scale: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26 }
                        : {
                            y: 0,
                            // Si veníamos de expandida, animamos el alto de vuelta a
                            // "auto" (encoge suave); si no, no controlamos el alto.
                            height: grownH === "auto" ? "auto" : undefined,
                            borderTopLeftRadius: 26,
                            borderTopRightRadius: 26,
                          }
                  }
                  exit={
                    isDesktop
                      ? { opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }
                      : { y: "100%", transition: { type: "tween", duration: 0.3, ease: [0.42, 0, 0.58, 1] } }
                  }
                  transition={
                    isDesktop
                      ? { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
                      : { type: "spring", damping: 34, stiffness: 340, mass: 0.9 }
                  }
                  drag={!isDesktop && !expanded ? "y" : false}
                  dragControls={dragControls}
                  dragListener={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.55 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 110 || info.velocity.y > 650) onOpenChange(false);
                  }}
                  onAnimationComplete={() => {
                    // Solo cuando el alto llegó a su destino final (100dvh), no en
                    // el frame intermedio que clona el alto de arranque.
                    if (expanded && grownH != null && grownH === targetHRef.current) {
                      onExpandComplete?.();
                    }
                  }}
                  // will-change: la hoja va a su propia capa GPU, así el slide/fade
                  // no repinta el contenido (evita el stutter/"entrecortado").
                  style={{ maxWidth, willChange: "transform, opacity" }}
                  className={
                    "pointer-events-auto flex w-full flex-col border-cart-line bg-cart-bg-elev text-cart-ink " +
                    (growFull
                      ? "max-h-none border-t "
                      : "max-h-[92vh] rounded-t-[26px] border-t shadow-[0_-16px_50px_-18px_rgba(20,10,60,0.28)] lg:rounded-[26px] lg:border lg:shadow-[0_28px_70px_-20px_rgba(20,10,60,0.4)] ") +
                    (className ?? "")
                  }
                >
                  {/* Asa de arrastre: SOLO en la hoja móvil (bottom-sheet). En
                      desktop es un modal centrado — sin detalles de drawer. Se
                      oculta también al crecer a pantalla completa. */}
                  {!isDesktop && !expanded && (
                    <div
                      className="shrink-0 cursor-grab touch-none pt-3 active:cursor-grabbing"
                      onPointerDown={(e) => dragControls.start(e)}
                    >
                      <div className="mx-auto h-1.5 w-9 rounded-full bg-cart-line-strong" />
                    </div>
                  )}

                  <Dialog.Title className="sr-only">{title}</Dialog.Title>
                  {description && (
                    <Dialog.Description className="sr-only">{description}</Dialog.Description>
                  )}

                  {/* Cuerpo scrolleable (x oculto: las transiciones de paso
                      deslizan en horizontal y no deben generar scroll lateral).
                      Expandida: respeta el notch arriba (ya no hay asa). */}
                  <div
                    className={
                      "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-[22px] pb-3 " +
                      // Sin asa arriba (modal desktop o pago) → padding-y para
                      // que respire; con asa (hoja móvil) el asa ya da el espacio.
                      (!isDesktop && !expanded ? "pt-1" : "pt-5")
                    }
                    style={growFull ? { paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" } : undefined}
                  >
                    {children}
                  </div>

                  {footer && (
                    <div
                      className="shrink-0 border-t border-cart-line px-[22px] pt-3"
                      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
                    >
                      {footer}
                    </div>
                  )}
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

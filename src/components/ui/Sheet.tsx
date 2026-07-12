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
import type { ReactNode } from "react";

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
}: Props) {
  const dragControls = useDragControls();

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
                transition={{ duration: 0.2 }}
                className="home-light fixed inset-0 z-[90] app-scrim"
              />
            </Dialog.Overlay>

            {/* Contenedor de posición (bottom en móvil, centro en desktop). No
                captura clicks salvo la hoja: Radix cierra al tocar fuera. */}
            <div className="home-light pointer-events-none fixed inset-0 z-[91] flex items-end justify-center lg:items-center lg:p-6">
              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 34, stiffness: 340, mass: 0.9 }}
                  drag="y"
                  dragControls={dragControls}
                  dragListener={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0, bottom: 0.55 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 110 || info.velocity.y > 650) onOpenChange(false);
                  }}
                  style={{ maxWidth }}
                  className={
                    "pointer-events-auto flex max-h-[92vh] w-full flex-col rounded-t-[26px] border-t border-cart-line bg-cart-bg-elev text-cart-ink " +
                    "shadow-[0_-16px_50px_-18px_rgba(20,10,60,0.28)] lg:rounded-[26px] lg:border lg:shadow-[0_28px_70px_-20px_rgba(20,10,60,0.4)] " +
                    (className ?? "")
                  }
                >
                  {/* Asa = única zona que inicia el arrastre (el cuerpo scrollea). */}
                  <div
                    className="shrink-0 cursor-grab touch-none pt-3 active:cursor-grabbing"
                    onPointerDown={(e) => dragControls.start(e)}
                  >
                    <div className="mx-auto h-1.5 w-9 rounded-full bg-cart-line-strong" />
                  </div>

                  <Dialog.Title className="sr-only">{title}</Dialog.Title>
                  {description && (
                    <Dialog.Description className="sr-only">{description}</Dialog.Description>
                  )}

                  {/* Cuerpo scrolleable. */}
                  <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-2 pt-1">{children}</div>

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

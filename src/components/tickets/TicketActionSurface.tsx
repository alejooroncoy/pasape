"use client";

import type { ReactNode, RefObject } from "react";
import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { useIsDesktop } from "@/lib/_shared/useIsDesktop";

type Props = {
  open: boolean;
  onClose: () => void;
  /** En desktop: popover anclado al botón. Sin anchor → diálogo centrado. */
  anchorRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  panelClassName?: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
};

export function TicketActionSurface({
  open,
  onClose,
  anchorRef,
  children,
  panelClassName = "w-[min(360px,calc(100vw-24px))]",
  side = "bottom",
  align = "end",
}: Props) {
  const isDesktop = useIsDesktop();

  if (isDesktop && anchorRef) {
    return (
      <Popover.Root open={open} onOpenChange={(next) => !next && onClose()}>
        <Popover.Anchor virtualRef={anchorRef as RefObject<Element>} />
        <AnimatePresence>
          {open && (
            <Popover.Portal forceMount>
              <div className="fixed inset-0 z-[70]" onClick={onClose} aria-hidden />
              <Popover.Content
                asChild
                side={side}
                align={align}
                sideOffset={8}
                collisionPadding={16}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className={
                    "z-[71] rounded-2xl border border-cart-line bg-cart-bg-elev p-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] " +
                    panelClassName
                  }
                >
                  {children}
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          )}
        </AnimatePresence>
      </Popover.Root>
    );
  }

  if (isDesktop) {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm px-5"
          >
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className={
                "max-h-[min(90vh,640px)] overflow-y-auto rounded-3xl border border-cart-line bg-cart-bg-elev p-5 " +
                panelClassName
              }
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 z-[81] mx-auto w-full max-w-[480px] rounded-t-[28px] border-t border-cart-line bg-cart-bg-elev px-5 pt-3 shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

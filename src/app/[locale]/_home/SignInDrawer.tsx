"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GoogleBtn } from "@/components/design";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
};

export function SignInDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn, pending, error } = useGoogleSignIn();
  const me = useCurrentUser();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (me.data?.user && open) onClose();
  }, [me.data, open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className={
            isDesktop
              ? "fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
              : "fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          }
        >
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.94, y: 12 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.94, y: 12 } : { y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            {...(!isDesktop && {
              drag: "y" as const,
              dragConstraints: { top: 0, bottom: 0 },
              dragElastic: { top: 0, bottom: 0.5 },
              onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
                if (info.offset.y > 120 || info.velocity.y > 800) onClose();
              },
            })}
            className={
              isDesktop
                ? "relative w-full max-w-[440px] mx-4 rounded-[22px] border border-cart-line-strong bg-cart-bg-elev p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
                : "w-full max-w-[420px] rounded-t-[26px] bg-cart-bg-elev px-[22px] pb-9 pt-3.5 shadow-[0_-1px_0_rgba(255,255,255,0.07)_inset,0_-30px_60px_-10px_rgba(0,0,0,0.7)] touch-none"
            }
          >
            {/* Drag handle solo en mobile */}
            {!isDesktop && (
              <div className="mb-4 flex justify-center">
                <div className="h-1 w-9 rounded-full bg-white/15" />
              </div>
            )}
            {/* Close button solo en desktop */}
            {isDesktop && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev-2 text-cart-ink-3 transition-colors hover:border-cart-line-strong hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.25 }}
              className="mb-1.5 font-sans text-[24px] font-bold leading-tight tracking-[-0.03em] text-white"
            >
              Entra a Pasape
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.25 }}
              className="mb-5 text-[13px] leading-[1.5] text-cart-ink-3"
            >
              Un toque y guardamos tus eventos favoritos.
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <GoogleBtn onClick={() => void signIn()} disabled={pending} />
            </motion.div>
            {error && (
              <div className="mt-3 text-center text-xs text-cart-ink-3" role="status">
                {error}
              </div>
            )}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.25 }}
              className="mt-3.5 text-center text-[11px] text-cart-ink-4"
            >
              Sin contraseña · sin apps
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

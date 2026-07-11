"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { GoogleBtn } from "@/components/design";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { clientEvents } from "@/lib/analytics/clientEvents";

type Props = {
  open: boolean;
  onClose: () => void;
  redirectTo?: string;
};

// Copy oficial único de login (no se varía por superficie — un solo componente).
const TITLE = "Entra a Pasape";
const SUBTITLE = "Guarda eventos, compra entradas y sigue a tus productoras favoritas.";

export function SignInDrawer({ open, onClose, redirectTo }: Props) {
  const { signIn, pending, error } = useGoogleSignIn({ redirectTo });
  const me = useCurrentUser();
  // Montado en cliente: createPortal necesita document (no existe en SSR).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  if (!mounted) return null;

  // Portal a <body>: escapa de cualquier stacking context del padre (p. ej. el
  // contenedor animado del LoginGate con z-[1]) que dejaría el drawer debajo del
  // tabbar. Así el z-[90] del overlay sí gana al tabbar (z-[70]).
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
              if (info.offset.y > 120 || info.velocity.y > 800) onClose();
            }}
            className="w-full max-w-[420px] rounded-t-[26px] bg-cart-bg-elev px-[22px] pb-9 pt-3.5 shadow-[0_-1px_0_rgba(255,255,255,0.07)_inset,0_-30px_60px_-10px_rgba(0,0,0,0.7)] touch-none lg:mb-0 lg:rounded-[26px] lg:pb-7 lg:shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)_inset]"
          >
            {/* Asa solo en móvil (bottom-sheet); en desktop es modal centrado. */}
            <div className="mb-4 flex justify-center lg:hidden">
              <div className="h-1 w-9 rounded-full bg-cart-ink/15" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.25 }}
              className="mb-1.5 font-sans text-[24px] font-bold leading-tight tracking-[-0.03em] text-cart-ink"
            >
              {TITLE}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.25 }}
              className="mb-5 text-[13px] leading-[1.5] text-cart-ink-3"
            >
              {SUBTITLE}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <GoogleBtn onClick={() => { clientEvents.signInStarted({ provider: "google" }); void signIn(); }} disabled={pending} />
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
    </AnimatePresence>,
    document.body,
  );
}

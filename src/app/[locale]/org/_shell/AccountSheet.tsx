"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { UserMenuItems, initialsOf } from "./UserPill";

export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useCurrentUser();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const user = me.data?.user;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
            className="fixed inset-0 z-[80] app-scrim lg:hidden"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Mi cuenta"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 360, mass: 0.8 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 800) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-[81] mx-auto w-full max-w-[480px] touch-none rounded-t-[24px] border-t border-cart-line-strong bg-cart-bg-elev px-4 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] pt-3 shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.7)] lg:hidden"
          >
            <div className="mb-4 flex justify-center">
              <div className="h-1 w-9 rounded-full bg-white/15" />
            </div>

            {user ? (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.25 }}
                  className="mb-4 flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-3.5 py-3"
                >
                  <motion.span
                    aria-hidden
                    initial={{ scale: 0.7, rotate: -8 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", damping: 18, stiffness: 320, delay: 0.12 }}
                    className="grid size-12 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#b87cff] text-[15px] font-semibold tracking-wide text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
                  >
                    {initialsOf(user.fullName, user.email)}
                  </motion.span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold text-white">
                      {user.fullName || user.email?.split("@")[0] || "Tú"}
                    </div>
                    {user.email && (
                      <div className="truncate text-[12.5px] text-cart-ink-3">{user.email}</div>
                    )}
                  </div>
                </motion.div>
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.05, delayChildren: 0.16 } },
                  }}
                >
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
                    }}
                  >
                    <UserMenuItems onClose={onClose} />
                  </motion.div>
                </motion.div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.25 }}
                className="px-1 pb-2"
              >
                <div className="mb-1.5 font-sans text-[20px] font-semibold tracking-[-0.02em] text-white">
                  Entra a Pasape
                </div>
                <div className="mb-5 text-[13px] text-cart-ink-3">
                  Inicia sesión para gestionar tus eventos y ventas.
                </div>
                <Link
                  href={"/org/login" as never}
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-cart-accent px-5 py-3.5 text-[14.5px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_8px_24px_-8px_var(--color-cart-accent-glow-strong)]"
                >
                  Iniciar sesión
                </Link>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

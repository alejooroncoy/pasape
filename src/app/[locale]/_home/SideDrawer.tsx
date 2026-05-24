"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloseIcon, WaIcon, MusicIcon, DjIcon, ComedyIcon, CultureIcon, PinIcon } from "./icons";
import { WA_HREF } from "./wa";

const CATEGORIES = [
  { name: "Música en vivo", Icon: MusicIcon },
  { name: "DJ Sets", Icon: DjIcon },
  { name: "Comedia", Icon: ComedyIcon },
  { name: "Cultura", Icon: CultureIcon },
];

export function SideDrawer({ open, onClose, onSignIn }: {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
}) {
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            aria-label="Menú"
            className="fixed inset-y-0 right-0 z-[81] flex w-[min(380px,86vw)] flex-col overflow-hidden border-l border-cart-line bg-cart-bg shadow-[-30px_0_60px_-20px_rgba(0,0,0,0.6)]"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-cart-line px-[22px] py-[18px]">
              <a href="/" className="inline-flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.01em]">
                <span className="grid size-[34px] place-items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icons/logo-icon-min.svg"
                    alt=""
                    className="size-full object-contain"
                  />
                </span>
                Pasape
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar menú"
                className="grid size-[38px] place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-ink-2 transition-colors hover:border-cart-line-strong hover:text-white"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-1.5 py-3.5 overscroll-contain">
              {/* Cuenta */}
              <div className="mx-[18px] mb-[18px] mt-2 flex items-center gap-3.5 rounded-[14px] border border-cart-line-strong p-4"
                style={{ background: "linear-gradient(180deg, rgba(184,124,255,0.10), rgba(184,124,255,0.02))" }}
              >
                <span className="grid size-11 flex-shrink-0 place-items-center rounded-full border border-cart-line-strong bg-cart-bg-elev-2 text-cart-accent">
                  <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
                    <circle cx="11" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 18.5C5 15.5 7.5 14 11 14s6 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <b className="block text-[14.5px] font-semibold text-white">Inicia sesión</b>
                  <span className="text-[12.5px] text-cart-ink-3">Guarda eventos, compra y comparte</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSignIn();
                  }}
                  className="rounded-full border-0 bg-cart-accent px-3.5 py-2 text-[12.5px] font-medium text-white shadow-[0_6px_18px_-6px_var(--color-cart-accent-glow-strong)]"
                >
                  Entrar
                </button>
              </div>

              <Section title="Estás explorando">
                <Item Icon={PinIcon} label="Lima" meta="cambiar ▾" />
              </Section>

              <Section title="Categorías" topBorder>
                {CATEGORIES.map(({ name, Icon }) => (
                  <Item key={name} Icon={Icon} label={name} meta="Pronto" />
                ))}
              </Section>

              <Section title="Pasape" topBorder>
                <a
                  href="/organizadores"
                  className="flex w-full items-center gap-3.5 rounded-[10px] bg-transparent px-4 py-[11px] text-[15px] font-medium text-cart-ink-2 hover:bg-cart-bg-elev hover:text-white"
                >
                  <span className="grid size-[22px] flex-shrink-0 place-items-center text-cart-ink-3">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M2.5 8a1.5 1.5 0 003 0V6.5h7V8a1.5 1.5 0 003 0V5.5a1 1 0 00-1-1h-11a1 1 0 00-1 1V8zm0 5a1.5 1.5 0 013 0v1.5h7V13a1.5 1.5 0 013 0v2.5a1 1 0 01-1 1h-11a1 1 0 01-1-1V13z" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </span>
                  Organizar mi evento
                </a>
              </Section>
            </div>

            <div className="flex-shrink-0 border-t border-cart-line bg-cart-bg px-[22px] py-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
              <div className="mb-3 text-center">
                <b className="block text-[13.5px] font-medium text-cart-ink-2">
                  ¿Algo no funciona o tenés dudas?
                </b>
                <span className="mt-0.5 block text-xs text-cart-ink-4">
                  Te respondemos al toque
                </span>
              </div>
              <a
                href={WA_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-cart-accent px-3.5 py-3.5 text-[14.5px] font-medium text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_14px_36px_-8px_var(--color-cart-accent-glow-strong)] transition-[transform,filter] duration-150 hover:-translate-y-px hover:brightness-110"
              >
                <WaIcon width={18} height={18} />
                Hablar con un humano
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, topBorder, children }: { title: string; topBorder?: boolean; children: React.ReactNode }) {
  return (
    <section className={`px-1.5 pb-3.5 pt-2 ${topBorder ? "border-t border-cart-line-2 pt-3.5" : ""}`}>
      <h6 className="mx-4 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-4">
        {title}
      </h6>
      {children}
    </section>
  );
}

function Item({ Icon, label, meta }: {
  Icon: (p: { width?: number; height?: number }) => React.ReactNode;
  label: string;
  meta?: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3.5 rounded-[10px] border-0 bg-transparent px-4 py-[11px] text-left text-[15px] font-medium text-cart-ink-2 transition-colors hover:bg-cart-bg-elev hover:text-white"
    >
      <span className="grid size-[22px] flex-shrink-0 place-items-center text-cart-ink-3">
        <Icon width={18} height={18} />
      </span>
      {label}
      {meta && <span className="ml-auto text-xs text-cart-ink-4">{meta}</span>}
    </button>
  );
}

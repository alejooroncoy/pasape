"use client";

import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useNewEventHref } from "@/lib/events/hooks/useNewEventHref";

const COPY = {
  upcoming: {
    title: "Aún no tienes eventos próximos",
    body: "Crea tu primer evento publicado para empezar a vender entradas y construir tu comunidad.",
    cta: "Crear evento",
    showCta: true,
  },
  past: {
    title: "Sin eventos finalizados",
    body: "Cuando un evento pase su fecha, aparecerá aquí con todos sus reportes y métricas.",
    cta: "",
    showCta: false,
  },
  draft: {
    title: "No tienes borradores",
    body: "Empieza un evento y guárdalo como borrador para terminarlo cuando estés listo.",
    cta: "Nuevo borrador",
    showCta: true,
  },
} as const;

export function EmptyState({ variant }: { variant: "upcoming" | "past" | "draft" }) {
  const copy = COPY[variant];
  // "draft" apunta siempre al composer completo — es el único con la opción
  // "guardar como borrador"; el flujo rápido publica de una, no tiene draft.
  const newEventHref = useNewEventHref();
  const href = variant === "draft" ? "/org/events/new" : newEventHref;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="col-span-full mx-auto flex w-full max-w-md flex-col items-center gap-5 px-6 py-12 text-center sm:rounded-3xl sm:border sm:border-dashed sm:border-cart-line sm:bg-cart-bg-elev/40"
    >
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-10 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(184,124,255,0.22), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 220 }}
          className="relative grid size-24 place-items-center rounded-[28px] border border-cart-line bg-gradient-to-br from-cart-bg-elev to-cart-bg shadow-[0_20px_50px_-20px_var(--color-cart-accent-glow)]"
        >
          <svg width="44" height="44" viewBox="0 0 28 28" fill="none">
            <rect
              x="4"
              y="6"
              width="20"
              height="18"
              rx="3"
              stroke="var(--color-cart-accent)"
              strokeWidth="1.6"
            />
            <path
              d="M4 11h20M9 3v5M19 3v5"
              stroke="var(--color-cart-accent)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <circle cx="14" cy="17" r="2" fill="var(--color-cart-accent)" />
          </svg>
        </motion.div>
      </div>
      <div className="space-y-2">
        <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-cart-ink sm:text-[18px]">
          {copy.title}
        </h3>
        <p className="text-[14.5px] leading-relaxed text-cart-ink-3 sm:text-[13px]">
          {copy.body}
        </p>
      </div>
      {copy.showCta && (
        <Link
          href={href as never}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-cart-accent px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow)] transition-transform active:scale-[0.98] sm:w-auto sm:px-5 sm:py-2.5 sm:text-[13px]"
        >
          <span className="text-[17px] leading-none sm:text-[15px]">+</span> {copy.cta}
        </Link>
      )}
    </motion.div>
  );
}

"use client";

import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

// CTA contextual de la zona logueada (barra superior, a la derecha). Lee la
// marca activa del usuario para decidir el destino y el copy — un solo botón
// que significa cosas distintas según quién mira:
//
//   • Ya vende (tiene marca)  → "Mi panel de eventos y shows" → /org (su panel)
//   • Aún no (fan)            → "¿Tienes un evento o show?"    → /organizadores
//
// Copy NEUTRAL a propósito (nada de "organizador"): el público nuevo son
// artistas independientes, no solo productoras. Reemplaza el "Soy organizador"
// que vivía duplicado en el header + el sidebar.
const TAP_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const;

export function SellerCta() {
  const me = useCurrentUser();
  const isSeller = Boolean(me.data?.activeOrgSlug);

  const href = isSeller ? "/org" : "/organizadores";
  const label = isSeller ? "Mi panel de eventos y shows" : "¿Tienes un evento o show?";
  const short = isSeller ? "Mi panel" : "Publicar";

  return (
    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} transition={TAP_SPRING}>
      <Link
        href={href as never}
        className={
          "group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13.5px] font-medium whitespace-nowrap transition-colors " +
          (isSeller
            ? "border-cart-line bg-cart-bg-elev text-cart-ink-2 hover:border-cart-line-strong hover:text-cart-ink"
            : "border-cart-accent/25 bg-cart-accent-soft text-cart-accent hover:border-cart-accent/45 hover:bg-cart-accent/12")
        }
      >
        <span
          className={
            "grid size-[18px] shrink-0 place-items-center " +
            (isSeller ? "text-cart-ink-3 group-hover:text-cart-ink" : "text-cart-accent")
          }
          aria-hidden
        >
          {isSeller ? (
            // Grid del panel
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="2" width="5" height="5" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
              <rect x="2" y="9" width="5" height="5" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="9" width="5" height="5" rx="1.3" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          ) : (
            // Crear. Antes había un destello de cuatro puntas: en toda la
            // industria ese icono significa "esto lo hace una IA", así que en un
            // botón de publicar no dice nada y sí delata la plantilla.
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <span className="max-[640px]:hidden">{label}</span>
        <span className="hidden max-[640px]:inline">{short}</span>
      </Link>
    </motion.div>
  );
}

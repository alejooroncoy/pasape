"use client";

import { motion } from "motion/react";
import { SignInButton } from "@/components/auth/SignInButton";

/**
 * Gate amable para páginas que requieren sesión (mi cuenta, mis entradas).
 * En vez de mostrar una pantalla vacía o romper, invita a iniciar sesión.
 *
 * "Iniciar sesión" abre el drawer reutilizable (más simple en móvil que navegar
 * a /login). Como ya estamos en la página destino, tras el login con Google se
 * vuelve a esta misma URL: el `next` se pasa como `redirectTo`.
 */
export function LoginGate({
  title,
  subtitle,
  next,
}: {
  title: string;
  subtitle: string;
  next: string;
}) {
  return (
    /* Centrado en el hueco REAL entre la cabecera y el tabbar, con los altos
       desde los tokens únicos de globals.css (antes cada consumidor los
       estimaba y el bloque quedaba 11px arriba del centro):
       — el div arranca ya debajo del header sticky, así que solo se le resta su
         alto;
       — el tabbar es fixed y no ocupa flujo, así que se compensa con padding
         inferior, y en desktop desaparece (lg:pb-0). */
    <div className="relative flex min-h-[calc(100dvh-var(--app-header-h))] items-center justify-center bg-cart-bg px-6 pb-[var(--app-tabbar-h)] font-sans text-cart-ink lg:pb-0">
      {/* Sin símbolo: la mascota ya vive en la cabecera y repetirla en la misma
          pantalla la debilita. Y sin el stack centrado (símbolo → título →
          subtítulo apagado → botón a todo el ancho, todo en medio del vacío),
          que es la silueta que delata la plantilla. El texto se alinea a la
          izquierda y el bloque se apoya arriba del centro óptico. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-[360px]"
      >
        <h1 className="text-[26px] font-bold leading-[1.1] tracking-[-0.03em] text-balance">
          {title}
        </h1>
        <p className="mt-2.5 max-w-[34ch] text-[14px] leading-[1.5] text-cart-ink-2">{subtitle}</p>

        {/* El drawer usa su copy oficial ("Entra a Pasape"); el título/subtítulo
            del gate solo viven en esta página. */}
        <SignInButton
          redirectTo={next}
          className="mt-6 w-full rounded-[10px] bg-cart-accent py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-cart-accent-strong"
        >
          Iniciar sesión
        </SignInButton>
      </motion.div>
    </div>
  );
}

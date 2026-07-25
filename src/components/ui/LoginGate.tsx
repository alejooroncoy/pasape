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
  // Alto = viewport − header (68px) − tabbar (72px): centra el contenido en el
  // hueco real entre el header y la barra inferior (no en todo el alto).
  return (
    /* Centrado en el hueco REAL entre la cabecera y el tabbar. Las medidas
       importan y las de antes estaban mal (68/72 contra 61/57 reales), así que
       el bloque quedaba 11px arriba del centro:
       — el div arranca ya debajo del header sticky, así que solo se le resta su
         alto (60px + 1px de borde; 68+1 sobre 560px, el mismo corte que usa
         AppHeader);
       — el tabbar es fixed y no ocupa flujo, así que su alto se compensa con
         padding inferior, con el env() del safe area incluido (en un iPhone real
         son ~34px más que en el navegador de escritorio). */
    <div className="relative flex min-h-[calc(100dvh-61px)] items-center justify-center bg-cart-bg px-6 pb-[calc(env(safe-area-inset-bottom,0px)+54px)] font-sans text-cart-ink min-[561px]:min-h-[calc(100dvh-69px)]">
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

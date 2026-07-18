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
    <div className="cart-grain relative grid min-h-[calc(100dvh-68px-72px)] place-items-center bg-cart-bg px-6 font-sans text-cart-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[560px] w-[900px] -translate-x-1/2 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, rgba(184,124,255,0.2), transparent 70%)" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-[1] w-full max-w-[360px] text-center"
      >
        <div
          className="mx-auto grid size-16 place-items-center rounded-[20px] text-white"
          style={{
            background: "linear-gradient(135deg, #FF4D5E, #7C3AED 60%, #4B1F9A)",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.1), 0 18px 40px -12px rgba(124,58,237,0.5)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-[22px] font-bold leading-tight tracking-[-0.02em]">
          {title}
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-cart-ink-2">{subtitle}</p>

        {/* El drawer usa su copy oficial ("Entra a Pasape"); el título/subtítulo
            del gate solo viven en esta página. */}
        <SignInButton
          redirectTo={next}
          className="mt-7 w-full rounded-full bg-cart-accent py-3.5 text-[15px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110"
        >
          Iniciar sesión
        </SignInButton>
      </motion.div>
    </div>
  );
}

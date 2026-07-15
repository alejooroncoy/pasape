"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { GoogleBtn } from "@/components/design";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { Logo } from "@/components/brand/Logo";

// Login de asistentes (comprar entradas, guardar eventos, seguir productoras).
// Para el panel de organizador ver /org/login (OrgLoginClient). Default next → home.
export function LoginClient() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/es";
  const { signIn, pending, error } = useGoogleSignIn({ redirectTo: next });

  return (
    <main className="home-light relative grid min-h-dvh place-items-center overflow-hidden bg-cart-bg px-6 py-12 text-cart-ink">
      {/* Decoración: glow púrpura arriba, inspirado en Resend */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124,58,237,0.28), rgba(124,58,237,0.06) 55%, transparent 75%)",
          filter: "blur(20px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 size-[420px] translate-x-1/3 translate-y-1/3 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,77,94,0.18), transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px] text-center"
      >
        {/* Logo oficial */}
        <div className="mb-6 inline-flex flex-col items-center">
          <div
            aria-hidden
            className="grid size-14 place-items-center rounded-[18px] bg-cart-bg-elev shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_20px_50px_-12px_rgba(124,58,237,0.45)]"
          >
            <Logo className="size-8" />
          </div>
          <div className="mt-3 font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-cart-ink-3">
            Pasape
          </div>
        </div>

        <h1 className="font-sans text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-cart-ink sm:text-[32px]">
          Entra a Pasape
        </h1>
        <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-snug text-cart-ink-3">
          Inicia sesión para comprar entradas, ver tus QR y seguir a tus productoras.
        </p>

        {/* Sin animación de entrada: es el CTA crítico de la página (sin él nadie
            puede entrar). Si el documento se monta oculto (backgrounding típico al
            abrir el link desde otra app en celular), framer-motion pausa su RAF y
            el botón queda invisible en opacity:0 para siempre — visto reportado
            por un usuario real. */}
        <div className="mt-8">
          <GoogleBtn onClick={() => void signIn()} disabled={pending} />
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-5 text-[11px] text-cart-ink-4">Sin contraseña · sin apps</div>

        <div className="mt-10 flex items-center justify-center gap-2 text-[11.5px] text-cart-ink-4">
          <span>¿Eres organizador?</span>
          <Link href="/org/login" className="font-medium text-cart-ink-2 hover:text-cart-ink">
            Entra al panel
          </Link>
        </div>
      </motion.div>
    </main>
  );
}

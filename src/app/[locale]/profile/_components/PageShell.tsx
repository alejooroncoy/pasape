"use client";

import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

// Shell común de las subpáginas de cuenta (editar, notificaciones, métodos de
// pago, organizadores que sigues). Tema "cart", mobile-first y centrado: en
// desktop respira dentro del layout junto al sidebar; en móvil ocupa el ancho.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="cart-grain relative min-h-screen bg-cart-bg font-sans text-cart-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[560px] w-[900px] -translate-x-1/2 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, rgba(124,58,237,0.12), transparent 70%)" }}
      />
      <div className="relative z-[1] mx-auto w-full max-w-[640px] px-4 pb-[96px] pt-3 sm:px-6">
        {children}
      </div>
    </div>
  );
}

// Volver al perfil. En desktop el sidebar ya navega, pero mantenerlo da contexto.
export function BackLink({ href = "/profile", label = "Perfil" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href as never}
      className="inline-flex items-center gap-1.5 py-2 text-[13px] font-medium text-cart-ink-3 transition hover:text-cart-ink"
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="pb-1 pt-2">
      <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-cart-ink">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[13.5px] text-cart-ink-3">{subtitle}</p>}
    </header>
  );
}

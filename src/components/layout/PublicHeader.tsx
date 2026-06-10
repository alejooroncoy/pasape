"use client";

import { Link } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

export function PublicHeader() {
  const me = useCurrentUser();
  const user = me.data?.user;
  const initial = user?.fullName?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-cart-line bg-cart-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center justify-between gap-4 px-[clamp(16px,4vw,48px)]">
        <Link
          href={"/" as never}
          className="inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/logo-icon-min.svg"
            alt="Pasape"
            className="size-8 object-contain drop-shadow-[0_2px_10px_rgba(184,124,255,0.35)]"
          />
          <span className="hidden sm:inline">Pasape</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href={"/tickets" as never}
            className="hidden items-center gap-1.5 rounded-full border border-cart-line bg-cart-bg-elev px-3.5 py-2 text-[13px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white sm:inline-flex"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 5a1 1 0 011-1h8a1 1 0 011 1v1a1 1 0 100 2v1a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 100-2V5z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path d="M7 4v6" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1.5 1.5" />
            </svg>
            Mis entradas
          </Link>

          {user ? (
            <Link
              href={"/org" as never}
              className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#b87cff] text-[12.5px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset]"
              aria-label="Mi cuenta"
            >
              {initial ?? "·"}
            </Link>
          ) : (
            <Link
              href={"/login" as never}
              className="inline-flex h-9 items-center rounded-full bg-cart-accent px-4 text-[13px] font-semibold text-white shadow-[0_6px_18px_-6px_var(--color-cart-accent-glow-strong)] transition hover:brightness-110"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

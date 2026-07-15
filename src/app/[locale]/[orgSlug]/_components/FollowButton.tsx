"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useFollow } from "@/lib/identity/hooks/useFollow";
import { SignInDrawer } from "@/app/[locale]/_home/SignInDrawer";

/**
 * Botón "Seguir" con login-gate estilo Luma: si el visitante es invitado, la
 * acción abre el mismo drawer de Google Sign-In del header (sin sacarlo de la
 * vitrina) y, apenas queda logueado, completa el follow solo — no hace falta
 * que vuelva a tocar "Seguir". Si ya está logueado, hace toggle optimista.
 */
export function FollowButton({
  orgId,
  orgSlug,
  size = "md",
}: {
  orgId: string;
  orgSlug: string;
  size?: "md" | "lg";
}) {
  const me = useCurrentUser();
  const isLogged = !!me.data?.user;
  const { isFollowing, toggle, isPending } = useFollow(orgId);

  const [signInOpen, setSignInOpen] = useState(false);
  const wantsFollowRef = useRef(false);

  // Si abrió el drawer para seguir y ya quedó logueado, dispara el follow solo.
  useEffect(() => {
    if (isLogged && wantsFollowRef.current) {
      wantsFollowRef.current = false;
      toggle();
    }
  }, [isLogged, toggle]);

  const cls =
    size === "lg" ? "h-12 px-6 text-[14px]" : "h-9 px-4 text-[12.5px]";

  const onClick = () => {
    if (!isLogged) {
      wantsFollowRef.current = true;
      setSignInOpen(true);
      return;
    }
    toggle();
  };

  if (isLogged && isFollowing) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={
          "group inline-flex items-center gap-1.5 rounded-full border border-cart-line bg-cart-bg-elev font-semibold text-cart-ink transition hover:border-rose-400/50 hover:text-rose-500 disabled:opacity-60 " +
          cls
        }
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M3 7.5l2.5 2.5L11 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="group-hover:hidden">Siguiendo</span>
        <span className="hidden group-hover:inline">Dejar de seguir</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={
          "inline-flex items-center gap-1.5 rounded-full bg-cart-accent font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)] transition hover:-translate-y-[1px] disabled:opacity-60 " +
          cls
        }
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Seguir
      </button>
      <SignInDrawer
        open={signInOpen}
        onClose={() => {
          // Si cancela sin loguearse, el intent de seguir no debe sobrevivir
          // — si no, un login posterior no relacionado dispararía el follow.
          wantsFollowRef.current = false;
          setSignInOpen(false);
        }}
        redirectTo={`/${orgSlug}`}
      />
    </>
  );
}

"use client";

import { motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { useSavedEvents } from "@/lib/identity/hooks/useSavedEvents";
import { useSaveEvent } from "@/lib/identity/hooks/useSaveEvent";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { LoginGate } from "@/components/ui/LoginGate";
import { formatDate } from "@/lib/_shared/format";
import { CATEGORY_BY_ID } from "../_home/categories";
import type { SavedEvent } from "@/server/events/application/ListSavedEvents";

function fallbackGradient(ev: SavedEvent): string {
  if (ev.category && CATEGORY_BY_ID[ev.category]) return CATEGORY_BY_ID[ev.category].gradient;
  return "linear-gradient(150deg, rgba(124,58,237,0.55), rgba(124,58,237,0.12))";
}

export default function FavoritesPage() {
  const saved = useSavedEvents();
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const router = useRouter();
  const items = saved.data ?? [];

  // Sin sesión → gate amable en vez de favoritos vacíos.
  if (!meLoading && !me?.user) {
    return (
      <LoginGate
        title="Inicia sesión para ver tus favoritos"
        subtitle="Guarda los eventos que te interesan y encuéntralos aquí cuando inicies sesión."
        next="/favorites"
      />
    );
  }

  return (
    <div className="cart-grain relative min-h-screen bg-cart-bg font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[560px] w-[900px] -translate-x-1/2 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, rgba(184,124,255,0.18), transparent 70%)" }}
      />
      <div className="relative z-[1] mx-auto w-full max-w-[640px] px-4 pb-[96px] pt-3 sm:px-6">
        <header className="py-3">
          <p className="text-[12px] font-medium text-white/50">Favoritos</p>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">
            {items.length} guardado{items.length === 1 ? "" : "s"}
          </h1>
        </header>

        {saved.isLoading && (
          <div className="flex flex-col gap-2.5 pt-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        )}

        {!saved.isLoading && items.length === 0 && <EmptyState />}

        {items.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-3">
            {items.map((ev) => (
              <SavedRow key={ev.id} ev={ev} onClick={() => router.push(`/events/${ev.slug}` as never)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SavedRow({ ev, onClick }: { ev: SavedEvent; onClick: () => void }) {
  const { toggle, isPending } = useSaveEvent(ev.id);
  const closed = ev.status === "closed" || ev.status === "cancelled";
  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      className={
        "relative flex w-full items-stretch overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev text-left transition hover:border-white/20 " +
        (closed ? "opacity-70" : "")
      }
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-stretch text-left">
        {/* Portada */}
        <div className="relative w-[88px] shrink-0 sm:w-[104px]">
          {ev.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ev.coverUrl} alt="" className={"absolute inset-0 size-full object-cover " + (closed ? "grayscale" : "")} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-[20px] font-bold text-white/90" style={{ background: fallbackGradient(ev) }}>
              {ev.title.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 px-3.5 py-3">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-cart-accent">
            {formatDate(ev.startsAt, "America/Lima")}
          </p>
          <p className="truncate pr-8 text-[15px] font-semibold leading-tight">{ev.title}</p>
          {ev.venue && <p className="mt-0.5 truncate text-[12px] text-white/55">{ev.venue}</p>}
          {closed && <p className="mt-1 text-[11px] text-white/40">Finalizado</p>}
        </div>
      </button>

      {/* Quitar de favoritos */}
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-label="Quitar de favoritos"
        className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-black/40 text-cart-accent backdrop-blur transition hover:bg-black/60 disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
          <path d="M9 15.5s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8Z" />
        </svg>
      </button>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <div
        className="mb-5 grid size-20 place-items-center rounded-3xl"
        style={{ background: "linear-gradient(150deg, rgba(124,58,237,0.35), rgba(124,58,237,0.08))" }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="text-white">
          <path
            d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5c0 5-7 9.5-7 9.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="text-[19px] font-bold tracking-[-0.01em]">Aún no guardas eventos</h2>
      <p className="mt-1.5 max-w-[280px] text-[13.5px] text-white/55">
        Toca el corazón en un evento para guardarlo aquí y no perdértelo.
      </p>
      <Link
        href={"/" as never}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-cart-accent px-6 py-3 text-[14.5px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--color-cart-accent-glow-strong)] transition active:scale-95"
      >
        Explorar eventos
      </Link>
    </div>
  );
}

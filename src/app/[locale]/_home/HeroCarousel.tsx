"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useBrowseEvents } from "@/lib/events/hooks/useEvents";
import type { Event } from "@/server/events/domain/Event";

const DURATION = 5000;

const shortMeta = (iso: string, tz: string, venue: string | null) => {
  const date = new Intl.DateTimeFormat("es-PE", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return venue ? `${date} · ${venue}` : date;
};

/* ─── Slide background ───────────────────────────────────────────────────── */
function SlideBg({ event, active }: { event: Event; active: boolean }) {
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-[900ms] ${active ? "opacity-100 z-[1]" : "opacity-0 z-0"}`}
      aria-hidden={!active}
    >
      {event.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.coverUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(150deg,#0f0020 0%,#3b0764 40%,#7c3aed 100%)" }}
        />
      )}
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="animate-pulse rounded-[20px] bg-cart-bg-elev" style={{ aspectRatio: "16/9" }} />
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export function HeroCarousel() {
  const events = useBrowseEvents();
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const list = events.data ?? [];
  const total = list.length;

  const go = (i: number) => setCur((i + total) % total);

  // Reset progress on slide change
  useEffect(() => {
    setProgress(0);
    if (progTimer.current) clearInterval(progTimer.current);
    if (total <= 1) return;
    progTimer.current = setInterval(
      () => setProgress(p => Math.min(p + 100 / (DURATION / 100), 100)),
      100,
    );
    return () => { if (progTimer.current) clearInterval(progTimer.current); };
  }, [cur, total]);

  // Auto-advance
  useEffect(() => {
    if (paused || total <= 1) {
      if (autoTimer.current) clearInterval(autoTimer.current);
      return;
    }
    autoTimer.current = setInterval(() => setCur(c => (c + 1) % total), DURATION);
    return () => { if (autoTimer.current) clearInterval(autoTimer.current); };
  }, [paused, total]);

  if (events.isLoading) {
    return (
      <section className="relative pt-[clamp(20px,3vw,36px)]">
        <div className="mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]">
          <Skeleton />
        </div>
      </section>
    );
  }

  // Sin eventos: fallback estático
  if (total === 0) {
    return (
      <section className="relative pt-[clamp(20px,3vw,36px)]">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 z-0 h-[600px] w-[1100px] -translate-x-1/2 blur-[60px]"
          style={{ background: "radial-gradient(closest-side, var(--color-cart-accent-soft), transparent 70%)" }}
        />
        <div className="relative z-10 mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]">
          <div
            className="relative overflow-hidden rounded-[20px] border border-cart-line"
            style={{ aspectRatio: "16/9", background: "var(--color-cart-bg-purple)" }}
          >
            <div className="absolute inset-x-0 bottom-0 p-[clamp(28px,4vw,56px)]">
              <h1 className="m-0 font-sans text-[clamp(34px,5.6vw,80px)] font-bold leading-[0.93] tracking-[-0.04em] text-white">
                Los mejores eventos<br />de Lima,{" "}
                <em className="font-serif italic font-normal text-cart-accent" style={{ textShadow: "0 0 32px var(--color-cart-accent-glow)" }}>
                  en un solo lugar.
                </em>
              </h1>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const ev = list[cur];

  return (
    <section
      className="relative pt-[clamp(20px,3vw,36px)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]">
        <div
          className="relative overflow-hidden rounded-[20px] border border-cart-line"
          style={{ aspectRatio: "16/9", boxShadow: "0 32px 64px -20px rgba(0,0,0,0.7)" }}
        >
          {/* Slides */}
          {list.map((e, i) => (
            <SlideBg key={e.id} event={e} active={i === cur} />
          ))}

          {/* Scrim — solo desde abajo */}
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            style={{ background: "linear-gradient(to top, rgba(4,4,8,0.97) 0%, rgba(4,4,8,0.75) 26%, rgba(4,4,8,0.08) 52%, transparent 72%)" }}
          />

          {/* Contenido principal */}
          <div
            className="absolute z-[3]"
            style={{
              left: "clamp(24px,4vw,52px)",
              right: "clamp(24px,4vw,52px)",
              bottom: "calc(60px + clamp(20px,3vw,40px))",
            }}
          >
            <p className="m-0 mb-2 text-[12px] text-white/35 font-sans tracking-[0.01em]">
              {shortMeta(ev.startsAt, ev.timezone, ev.venue ?? null)}
            </p>
            <h1 className="m-0 mb-5 font-sans text-[clamp(28px,5vw,66px)] font-bold leading-[0.92] tracking-[-0.04em] text-white">
              {ev.title}
            </h1>
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/events/${ev.slug}` as any}
              className="inline-flex items-center gap-2.5 rounded-full bg-cart-accent px-6 py-3 text-[13.5px] font-bold text-white transition-[filter] hover:brightness-110"
              style={{ boxShadow: "0 6px 24px -6px var(--color-cart-accent-glow-strong)" }}
            >
              Comprar entradas
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* Barra glass inferior */}
          <div
            className="absolute bottom-0 left-0 right-0 z-[4] border-t border-white/[0.06]"
            style={{ background: "rgba(6,6,12,0.65)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            {/* Barra de progreso */}
            {total > 1 && (
              <div className="h-[2px] bg-white/[0.06]">
                <div
                  className="h-full bg-cart-accent/70 transition-[width] duration-100 linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Controles */}
            <div className="flex items-center justify-between px-[clamp(16px,3vw,44px)] py-[10px]">
              <span className="text-[11px] text-white/25 font-sans tracking-[0.03em]">
                {cur + 1} de {total} eventos
              </span>
              {total > 1 && (
                <div className="flex gap-1.5">
                  {([-1, 1] as const).map(dir => (
                    <button
                      key={dir}
                      onClick={() => go(cur + dir)}
                      aria-label={dir === -1 ? "Anterior" : "Siguiente"}
                      className="flex size-[30px] items-center justify-center rounded-[8px] border border-white/[0.08] bg-transparent text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d={dir === -1 ? "M9 3 5 7l4 4" : "M5 3l4 4-4 4"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

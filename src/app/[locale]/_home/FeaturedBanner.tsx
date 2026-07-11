"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useBrowseEvents } from "@/lib/events/hooks/useEvents";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { eventDateTime } from "@/lib/_shared/format";

// Auto-avance del carrusel: la barra (.hero-progress-bar, en globals.css) llena
// de 0 a 100 % en este tiempo y onAnimationEnd pasa al siguiente evento.
const DURATION_MS = 6000;

// Banner-carrusel destacado (columna principal del home): el diseño claro con
// tinte azul/morado + capa tipográfica de fondo, con el comportamiento del
// carrusel de siempre — auto-avance, pausa al hover, swipe en móvil, flechas
// y contador. Todo se activa solo cuando hay más de un evento.
export function FeaturedBanner() {
  const events = useBrowseEvents();
  const list = events.data ?? [];
  const total = list.length;
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);

  // Swipe horizontal en móvil (el ICP navega sobre todo con el dedo).
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null || total < 2) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  if (events.isLoading) {
    return <div className="animate-pulse rounded-[18px] bg-cart-bg-elev" style={{ aspectRatio: "16/6" }} />;
  }
  if (total === 0) return null;

  const ev = list[cur % total];
  // Navegar reanuda la animación — si no, tras clickear con el cursor encima
  // la barra quedaría pausada en 0 %.
  const go = (dir: 1 | -1) => {
    setCur((c) => (c + dir + total) % total);
    setPaused(false);
  };

  return (
    <div
      className="relative overflow-hidden rounded-[18px] border border-cart-line p-4 sm:flex sm:min-h-[clamp(230px,24vw,310px)] sm:flex-col sm:justify-center sm:p-[clamp(20px,3vw,40px)]"
      style={{
        background:
          "linear-gradient(115deg, rgba(79,109,245,0.10) 0%, rgba(124,58,237,0.07) 52%, rgba(79,109,245,0.04) 100%)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Capa tipográfica de fondo (patrón de Posh): el nombre del evento
          gigante y translúcido detrás del contenido. */}
      <span
        key={`bg-${ev.id}`}
        className="pointer-events-none absolute -bottom-[0.18em] left-[clamp(90px,16vw,220px)] select-none whitespace-nowrap font-sans text-[clamp(56px,9vw,130px)] font-extrabold uppercase leading-none tracking-[-0.04em] text-cart-accent/[0.06]"
        aria-hidden
      >
        {ev.title}
      </span>

      {/* Contenido del slide — anima la entrada en cada cambio (sin capa de
          salida: evita saltos de layout). */}
      <motion.div
        key={ev.id}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="flex items-center gap-3.5 sm:gap-[clamp(24px,4vw,48px)]">
          {ev.coverUrl && (
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/events/${ev.slug}` as any}
              className="flex-shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={optimizeImageUrl(ev.coverUrl, "hero-lcp") ?? ev.coverUrl}
                alt={ev.title}
                fetchPriority="high"
                className="h-[112px] w-auto rounded-[10px] object-cover shadow-[0_14px_34px_-14px_rgba(50,30,120,0.45)] sm:h-[clamp(150px,19vw,235px)] sm:rounded-[12px]"
              />
            </Link>
          )}

          <div className="relative min-w-0 flex-1 py-0.5 sm:py-1">
            <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-cart-accent/12 px-2.5 py-1 text-[10.5px] font-bold text-cart-accent sm:mb-3 sm:px-3 sm:py-1.5 sm:text-[clamp(11px,1.1vw,12.5px)]">
              <span className="size-1.5 rounded-full bg-cart-accent" aria-hidden />
              {eventDateTime(ev.startsAt, ev.timezone)}
            </span>
            <h2 className="m-0 mb-0.5 line-clamp-2 font-sans text-[17.5px] font-bold leading-[1.1] tracking-[-0.02em] text-cart-ink sm:mb-1.5 sm:text-[clamp(22px,3vw,40px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
              {ev.title}
            </h2>
            {ev.venue && (
              <p className="m-0 line-clamp-1 text-[12px] text-cart-ink-3 sm:mb-5 sm:text-[clamp(12.5px,1.3vw,14.5px)]">
                {ev.venue}
              </p>
            )}
            {/* CTA inline solo en desktop; en móvil va full-width abajo */}
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/events/${ev.slug}` as any}
              className="hidden items-center gap-2 rounded-full bg-cart-accent px-[clamp(16px,2vw,24px)] py-[clamp(9px,1.2vw,12px)] text-[clamp(12.5px,1.3vw,14px)] font-bold text-white shadow-[0_8px_20px_-8px_var(--color-cart-accent-glow-strong)] transition-transform hover:-translate-y-px sm:inline-flex"
            >
              Comprar entradas
              <ArrowIcon />
            </Link>
          </div>
        </div>

        {/* CTA móvil: full-width, cómodo para el pulgar */}
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={`/events/${ev.slug}` as any}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-full bg-cart-accent py-3 text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_var(--color-cart-accent-glow-strong)] sm:hidden"
        >
          Comprar entradas
          <ArrowIcon />
        </Link>
      </motion.div>

      {/* Contador + flechas — solo con más de un evento */}
      {total > 1 && (
        <div className="mt-3 flex items-center justify-between sm:mt-0 sm:absolute sm:bottom-[16px] sm:right-[16px] sm:justify-end sm:gap-3">
          <span className="text-[11.5px] font-medium text-cart-ink-3">
            {(cur % total) + 1} de {total}
          </span>
          <div className="flex gap-1.5">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => go(dir)}
                aria-label={dir === -1 ? "Anterior" : "Siguiente"}
                className="flex size-[32px] items-center justify-center rounded-full border border-cart-line-strong bg-cart-bg text-cart-ink-2 transition-colors hover:border-cart-accent hover:text-cart-ink"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d={dir === -1 ? "M9 3 5 7l4 4" : "M5 3l4 4-4 4"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra de progreso del auto-avance (CSS puro, GPU): key={cur} la
          reinicia en cada slide; el hover la pausa. */}
      {total > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-cart-accent/10">
          <div
            key={cur}
            className="hero-progress-bar h-full w-full bg-cart-accent/60"
            style={{
              animationDuration: `${DURATION_MS}ms`,
              animationPlayState: paused ? "paused" : "running",
            }}
            onAnimationEnd={() => setCur((c) => (c + 1) % total)}
          />
        </div>
      )}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

"use client";

import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useBrowseEvents } from "@/lib/events/hooks/useEvents";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { eventDateTime, shortEventDateTime } from "@/lib/_shared/format";
import { splitFeatured } from "./featured";

// Auto-avance del carrusel: la barra (.hero-progress-bar, en globals.css) llena
// de 0 a 100 % en este tiempo y onAnimationEnd pasa al siguiente evento.
const DURATION_MS = 6000;

// Desplazamiento mínimo para que un arrastre cuente como cambio de slide.
const SWIPE_PX = 40;

// Controles del carrusel: 44 px de target en táctil, compactos donde hay
// puntero fino.
const ctrlClass =
  "flex size-11 items-center justify-center rounded-full border border-cart-line-strong bg-cart-bg text-cart-ink-2 transition-colors hover:border-cart-accent hover:text-cart-ink sm:size-8";

// Banner-carrusel destacado (columna principal del home): el diseño claro con
// tinte azul/morado + capa tipográfica de fondo, con el comportamiento del
// carrusel de siempre — auto-avance, pausa al hover, swipe en móvil, flechas
// y contador. Todo se activa solo cuando hay más de un evento.
export function FeaturedBanner() {
  const events = useBrowseEvents();
  const reduceMotion = useReducedMotion();
  // Los que NO están acá los muestra la grilla — ver `splitFeatured`.
  const list = splitFeatured(events.data ?? []).featured;
  const total = list.length;
  const [cur, setCur] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  // Pausa explícita del usuario. El hover no sirve en táctil, y sin un control
  // real el carrusel cambia de evento a mitad de lectura (WCAG 2.2.2).
  const [userPaused, setUserPaused] = useState(false);
  // `reduceMotion` no entra acá: con esa preferencia la barra ni se monta, así
  // que no hay nada que pausar (ver el guard del bloque de progreso).
  const paused = hoverPaused || userPaused;
  // Con `prefers-reduced-motion` no hay avance automático, así que tampoco hay
  // controles de avance: un botón de pausa que no pausa nada es peor que no
  // tenerlo (aria-pressed alternando sobre un no-op).
  const showAutoAdvance = total > 1 && !reduceMotion;

  // Swipe horizontal en móvil (el ICP navega sobre todo con el dedo).
  const touchX = useRef<number | null>(null);
  // El contenedor envuelve un <Link>, así que hay que decidir si el clic que
  // llega después del gesto es un tap o el residuo de un arrastre. Se marca solo
  // cuando el swipe REALMENTE cambió de slide: bloquearlo con cualquier
  // desplazamiento mataba taps legítimos (un dedo se mueve 10 px al tocar) y,
  // con un solo evento en el banner, el swipe no navega pero igual anulaba el
  // tap — o sea el elemento más importante del home no respondía.
  const swiped = useRef(false);
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
    swiped.current = false;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const startX = touchX.current;
    touchX.current = null; // se limpia siempre, también en los early-return
    if (startX == null || total < 2) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) <= SWIPE_PX) return;
    swiped.current = true;
    go(dx < 0 ? 1 : -1);
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
    setHoverPaused(false);
  };

  return (
    <div
      className="relative overflow-hidden rounded-[18px] border border-cart-line p-4 sm:flex sm:min-h-[clamp(230px,24vw,310px)] sm:flex-col sm:justify-center sm:p-[clamp(20px,3vw,40px)]"
      style={{
        background:
          "linear-gradient(115deg, rgba(79,109,245,0.10) 0%, rgba(124,58,237,0.07) 52%, rgba(79,109,245,0.04) 100%)",
      }}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setHoverPaused(true)}
      onBlurCapture={() => setHoverPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Contenido del slide — anima la entrada en cada cambio (sin capa de
          salida: evita saltos de layout). */}
      <motion.div
        key={ev.id}
        initial={reduceMotion ? false : { opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Toda la card es el enlace al evento (sin botón): un tap en cualquier
            parte lleva a la página del evento. La afición "Ver evento →" (texto,
            no botón relleno) señala que es clickeable sin saturar. */}
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={`/events/${ev.slug}` as any}
          onClick={(e) => {
            if (swiped.current) e.preventDefault();
          }}
          className="group/card flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-[clamp(24px,4vw,48px)]"
        >
          {ev.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={optimizeImageUrl(ev.coverUrl, "hero-lcp") ?? ev.coverUrl}
              alt={ev.title}
              fetchPriority="high"
              className="h-[260px] w-full flex-shrink-0 rounded-[12px] object-cover object-center shadow-[0_14px_34px_-14px_rgba(50,30,120,0.45)] transition-transform duration-300 group-hover/card:-translate-y-0.5 sm:h-[clamp(150px,19vw,235px)] sm:w-auto sm:rounded-[12px]"
            />
          )}

          {/* Mobile: todo el bloque de texto a la izquierda y el botón a la
              derecha, en la misma fila (más fácil de tocar que el link de
              texto, y ancla visualmente la card). Desktop: vuelve al stack
              vertical con el link de texto original debajo. */}
          <div className="relative flex min-w-0 flex-1 items-center justify-between gap-3 py-0.5 sm:block sm:py-1">
            <div className="min-w-0">
              {/* `accent-strong`: el morado base sobre este relleno al 12 % se
                  queda en 4.4:1 y el dato de fecha es texto de lectura. */}
              <span className="mb-1.5 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-cart-accent/12 px-2.5 py-1 text-[10.5px] font-bold text-cart-accent-strong sm:mb-3 sm:px-3 sm:py-1.5 sm:text-[clamp(11px,1.1vw,12.5px)]">
                <span className="size-1.5 rounded-full bg-cart-accent" aria-hidden />
                {/* Móvil: formato corto (una sola línea, no envuelve). Desktop: largo. */}
                <span className="sm:hidden">{shortEventDateTime(ev.startsAt, ev.timezone)}</span>
                <span className="hidden sm:inline">{eventDateTime(ev.startsAt, ev.timezone)}</span>
              </span>
              <h2 className="m-0 mb-0.5 line-clamp-2 font-sans text-[17.5px] font-bold leading-[1.1] tracking-[-0.02em] text-cart-ink sm:mb-1.5 sm:text-[clamp(22px,3vw,40px)] sm:leading-[1.05] sm:tracking-[-0.03em]">
                {ev.title}
              </h2>
              {ev.venue && (
                <p className="m-0 flex items-center gap-1 text-[12px] text-cart-ink-3 sm:gap-1.5 sm:text-[clamp(12.5px,1.3vw,14.5px)]">
                  <PinIcon />
                  <span className="line-clamp-1">{ev.venue}</span>
                </p>
              )}
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cart-accent px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_8px_20px_-7px_var(--color-cart-accent-glow-strong)] transition-[background-color,transform] group-hover/card:bg-cart-accent-strong sm:mt-5 sm:px-5 sm:py-2.5 sm:text-[clamp(12.5px,1.3vw,14px)]">
              Ver evento
              <span className="transition-transform duration-200 group-hover/card:translate-x-0.5">
                <ArrowIcon />
              </span>
            </span>
          </div>
        </Link>
      </motion.div>

      {/* Contador + controles — solo con más de un evento. Los targets son de
          44 px en táctil y se compactan donde hay puntero fino. */}
      {total > 1 && (
        <div className="mt-3 flex items-center justify-between sm:mt-0 sm:absolute sm:bottom-[16px] sm:right-[16px] sm:justify-end sm:gap-3">
          <span className="text-[11.5px] font-medium text-cart-ink-3">
            {(cur % total) + 1} de {total}
          </span>
          <div className="flex gap-1.5">
            {showAutoAdvance && (
            <button
              onClick={() => setUserPaused((v) => !v)}
              aria-pressed={userPaused}
              aria-label={userPaused ? "Reanudar el cambio automático" : "Detener el cambio automático"}
              className={ctrlClass}
            >
              {userPaused ? (
                <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                  <path d="M4 2.6v8.8l7-4.4z" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
                  <rect x="3.5" y="2.6" width="2.6" height="8.8" rx="0.8" />
                  <rect x="7.9" y="2.6" width="2.6" height="8.8" rx="0.8" />
                </svg>
              )}
            </button>
            )}
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => go(dir)}
                aria-label={dir === -1 ? "Anterior" : "Siguiente"}
                className={ctrlClass}
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d={dir === -1 ? "M9 3 5 7l4 4" : "M5 3l4 4-4 4"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra de progreso del auto-avance (CSS puro, GPU): key={cur} la
          reinicia en cada slide. Con `prefers-reduced-motion` no se monta:
          sin barra no hay `onAnimationEnd`, o sea el carrusel no avanza solo. */}
      {showAutoAdvance && (
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

function PinIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="shrink-0 text-cart-ink-4 sm:size-[13px]"
    >
      <path
        d="M7 1.75c-2.14 0-3.88 1.7-3.88 3.8 0 2.66 3.88 6.7 3.88 6.7s3.88-4.04 3.88-6.7c0-2.1-1.74-3.8-3.88-3.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="5.5" r="1.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

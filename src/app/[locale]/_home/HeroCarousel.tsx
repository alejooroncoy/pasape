"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useBrowseEvents } from "@/lib/events/hooks/useEvents";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import type { Event } from "@/server/events/domain/Event";

// Duración del auto-avance. La barra (.hero-progress-bar) anima de 0 a 100 % en
// este tiempo y, al terminar, onAnimationEnd avanza el slide.
const DURATION_MS = 5000;

const shortDate = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("es-PE", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    // El ICU de Node y el del navegador difieren en el espacio que ponen antes
    // de "p. m." (U+202F vs U+00A0), lo que rompía la hidratación. Normalizamos
    // cualquier espacio angosto/duro a un espacio normal para que SSR y cliente
    // produzcan exactamente el mismo string.
    .replace(/[\u202f\u00a0]/g, " ");

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
  // Ratio (ancho/alto) de cada flyer, medido al cargar. El marco del thumbnail
  // adopta el ratio del flyer actual → los horizontales llenan sin barras.
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const list = events.data ?? [];
  const total = list.length;

  // Navegación manual: cambia de slide (key={cur} reinicia la barra desde 0) y
  // reanuda la animación — si no, al clickear las flechas con el cursor sobre
  // el carrusel quedaría pausada en 0 % por el hover.
  const go = (i: number) => {
    setCur((i + total) % total);
    setPaused(false);
  };

  // Swipe horizontal en móvil (el ICP navega sobre todo con el dedo).
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };

  // Pre-mide el ratio de cada flyer para que el marco ya tenga la orientación
  // correcta antes del fade (evita un salto de tamaño al cargar la imagen).
  useEffect(() => {
    list.forEach((e) => {
      const thumb = optimizeImageUrl(e.coverUrl, "measure");
      if (!thumb) return;
      const img = new Image();
      img.onload = () =>
        setRatios((r) =>
          r[e.id] ? r : { ...r, [e.id]: img.naturalWidth / img.naturalHeight },
        );
      img.src = thumb;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  if (events.isLoading) {
    return (
      <section className="relative pt-[clamp(20px,3vw,36px)]">
        <div className="mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]">
          <Skeleton />
        </div>
      </section>
    );
  }

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
  // Dos formatos FIJOS para que el marco no cambie de tamaño entre flyers:
  // apaisado → caja banner (ancho fijo); vertical/cuadrado → caja retrato (usa
  // toda la altura). motion anima el cambio de tamaño entre orientaciones.
  const curRatio = ev ? ratios[ev.id] : undefined;
  const isLandscape = !!curRatio && curRatio >= 1.15;
  const box = isLandscape ? { width: 440, height: 294 } : { width: 352, height: 440 };

  return (
    <section
      className="relative pt-[clamp(20px,3vw,36px)]"
    >
      <div className="mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]">
        <div
          className="relative h-[560px] overflow-hidden rounded-[20px] border border-cart-line sm:h-auto sm:aspect-[16/9]"
          style={{ boxShadow: "0 32px 64px -20px rgba(0,0,0,0.7)" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Fondo difuminado — solo desktop. En móvil esta capa era el LCP
              (1.4 MB full-res + blur) y penalizaba PageSpeed sin aportar UX. */}
          <div className="absolute inset-0 z-[1] hidden sm:block" aria-hidden>
            <AnimatePresence initial={false}>
              <motion.div
                key={ev.id}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
              >
                {ev.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={optimizeImageUrl(ev.coverUrl, "hero-blur") ?? ev.coverUrl}
                    alt=""
                    loading="lazy"
                    fetchPriority="low"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ filter: "blur(32px) saturate(1.3)", transform: "scale(1.08)" }}
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(150deg,#0f0020 0%,#3b0764 40%,#7c3aed 100%)" }}
                  />
                )}
                <div className="absolute inset-0" style={{ background: "rgba(4,4,8,0.78)" }} />
              </motion.div>
            </AnimatePresence>
          </div>
          {/* Móvil: gradiente estático — sin imagen de fondo pesada */}
          <div
            className="absolute inset-0 z-[1] sm:hidden"
            aria-hidden
            style={{ background: "linear-gradient(150deg,#0f0020 0%,#3b0764 40%,#7c3aed 100%)" }}
          />
          <div className="absolute inset-0 z-[1] sm:hidden" aria-hidden style={{ background: "rgba(4,4,8,0.78)" }} />

          {/* ===== DESKTOP: split flyer | info ===== El hover pausa SOLO aquí
              (contenido), no en el footer de flechas/contador. */}
          <div
            className="absolute inset-0 z-[2] hidden sm:flex"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {/* ── Flyer thumbnail ── */}
            <div className="flex items-center justify-center p-[clamp(16px,3vw,40px)]" style={{ width: "42%" }}>
              {/* Marco de tamaño fijo por orientación; motion anima el cambio de
                  tamaño y AnimatePresence hace el fade entre slides (un flyer a
                  la vez), evitando que la foto anterior quede atrapada al saltar
                  de horizontal a vertical. */}
              <motion.div
                className="relative overflow-hidden rounded-[14px] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.7)]"
                animate={{ width: box.width, height: box.height }}
                transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                style={{ maxWidth: "100%" }}
              >
                <AnimatePresence initial={false}>
                  <motion.div
                    key={ev.id}
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  >
                    {ev.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={optimizeImageUrl(ev.coverUrl, "hero-lcp") ?? ev.coverUrl}
                        alt={ev.title}
                        fetchPriority={cur === 0 ? "high" : "auto"}
                        loading={cur === 0 ? "eager" : "lazy"}
                        onLoad={(imgEv) => {
                          const img = imgEv.currentTarget;
                          const ar = img.naturalWidth / img.naturalHeight;
                          setRatios((r) => (r[ev.id] ? r : { ...r, [ev.id]: ar }));
                        }}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{ background: "linear-gradient(150deg,#0f0020 0%,#3b0764 40%,#7c3aed 100%)" }}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>

            {/* ── Info del evento ── */}
            <div
              className="flex flex-1 flex-col justify-center pb-[60px]"
              style={{ paddingRight: "clamp(24px,4vw,56px)" }}
            >
              <p className="m-0 mb-3 text-[clamp(10px,1.1vw,13px)] font-medium text-white/80 font-sans tracking-[0.04em] uppercase">
                {shortDate(ev.startsAt, ev.timezone)}
              </p>
              {ev.venue && (
                <p className="m-0 mb-3 text-[clamp(11px,1.2vw,14px)] text-white/70 font-sans">
                  {ev.venue}
                </p>
              )}
              <h1 className="m-0 mb-6 font-sans text-[clamp(26px,4vw,60px)] font-bold leading-[0.92] tracking-[-0.04em] text-white">
                {ev.title}
              </h1>
              <Link
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                href={`/events/${ev.slug}` as any}
                className="inline-flex w-fit items-center gap-2.5 rounded-full bg-cart-accent-strong px-6 py-3 text-[13.5px] font-bold text-white transition-[filter] hover:brightness-110"
                style={{ boxShadow: "0 6px 24px -6px var(--color-cart-accent-glow-strong)" }}
              >
                Comprar entradas
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>

          {/* ===== MÓVIL: card de altura fija (no cambia entre slides) con
              transición animada (fade + slide) al deslizar ===== */}
          <div className="absolute inset-0 z-[2] sm:hidden">
            <AnimatePresence initial={false}>
              <motion.div
                key={ev.id}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5 pb-10 text-center"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              >
                {/* Marco fijo 4/5 + object-cover: todos los flyers (horizontal o
                    vertical) ocupan el mismo tamaño. */}
                <div className="aspect-[4/5] w-full max-w-[256px] overflow-hidden rounded-[16px] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.7)]">
                  {ev.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={optimizeImageUrl(ev.coverUrl, "hero-lcp") ?? ev.coverUrl}
                      alt={ev.title}
                      fetchPriority={cur === 0 ? "high" : "auto"}
                      loading={cur === 0 ? "eager" : "lazy"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ background: "linear-gradient(150deg,#0f0020 0%,#3b0764 40%,#7c3aed 100%)" }}
                    />
                  )}
                </div>
                <div className="flex flex-col items-center">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-white/80 font-sans">
                    {shortDate(ev.startsAt, ev.timezone)}
                  </p>
                  <h1 className="m-0 mb-1 line-clamp-2 max-w-[20ch] font-sans text-[21px] font-bold leading-[1.1] tracking-[-0.03em] text-white">
                    {ev.title}
                  </h1>
                  {ev.venue && (
                    <p className="mb-4 line-clamp-1 text-[12.5px] text-white/65 font-sans">{ev.venue}</p>
                  )}
                  <Link
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    href={`/events/${ev.slug}` as any}
                    className="mt-1 inline-flex items-center gap-2 rounded-full bg-cart-accent-strong px-6 py-2.5 text-[13px] font-bold text-white"
                    style={{ boxShadow: "0 6px 24px -6px var(--color-cart-accent-glow-strong)" }}
                  >
                    Comprar entradas
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Barra glass inferior */}
          <div
            className="absolute bottom-0 left-0 right-0 z-[4] border-t border-white/[0.06]"
            style={{ background: "rgba(6,6,12,0.65)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
          >
            {total > 1 && (
              <div className="h-[2px] bg-white/[0.06]">
                {/* Animación CSS pura (compositor/GPU): se llena de 0 a 100 % y
                    al terminar avisa por onAnimationEnd para avanzar el slide.
                    key={cur} reinicia la animación en cada slide; el hover la
                    pausa. Sin timers ni re-render por frame. */}
                <div
                  key={cur}
                  className="hero-progress-bar h-full w-full bg-cart-accent/70"
                  style={{
                    animationDuration: `${DURATION_MS}ms`,
                    animationPlayState: paused ? "paused" : "running",
                  }}
                  onAnimationEnd={() => setCur((c) => (c + 1) % total)}
                />
              </div>
            )}
            <div className="flex items-center justify-between px-[clamp(16px,3vw,44px)] py-[10px]">
              <span className="text-[12px] font-medium text-white/60 font-sans tracking-[0.03em]">
                {cur + 1} de {total} eventos
              </span>
              {total > 1 && (
                // En móvil se navega con swipe; las flechas son para desktop.
                <div className="hidden gap-1.5 sm:flex">
                  {([-1, 1] as const).map(dir => (
                    <button
                      key={dir}
                      onClick={() => go(cur + dir)}
                      aria-label={dir === -1 ? "Anterior" : "Siguiente"}
                      className="flex size-[34px] items-center justify-center rounded-[9px] border border-white/15 bg-white/[0.04] text-white/75 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
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

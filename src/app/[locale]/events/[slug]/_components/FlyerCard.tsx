"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { clientEvents } from "@/lib/analytics/clientEvents";
import { eventDatePillParts, formatMoney } from "@/lib/_shared/format";
import { useSaveEvent } from "@/lib/identity/hooks/useSaveEvent";
import { useAuthGatedAction } from "@/lib/identity/hooks/useAuthGatedAction";
import { SignInDrawer } from "@/app/[locale]/_home/SignInDrawer";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { derivePalette, type Palette } from "@/lib/_shared/color";

// Extraído de EventDetailClient.tsx para poder reusarlo también en /demo
// (sandbox de identidad de marca) sin duplicar el hero real del evento.

export function EndedBadge() {
  return (
    <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-cart-line bg-cart-bg-elev px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-cart-ink-3">
      <span className="size-1.5 rounded-full bg-cart-ink-4" />
      Evento terminado
    </span>
  );
}

export function FlyerCard({
  event,
  eventId,
  variant,
  fromPriceCents,
  isClosed,
  orgBrandColor,
  cornerStyle = "rounded",
}: {
  event: {
    title: string;
    coverUrl: string | null;
    timezone: string;
    startsAt: string;
    venue: string | null;
  };
  eventId: string;
  palette?: Palette | null;
  /** "ticket" = póster + talón con título/datos; "immersive" = color del flyer baña la cabecera. */
  variant: "ticket" | "immersive";
  fromPriceCents: number | null;
  isClosed: boolean;
  /** Sin flyer, el degradado de fondo usa esto en vez del morado de Pasape. */
  orgBrandColor?: string | null;
  /** Sandbox de identidad (/demo): "sharp" prueba una marca más recta/técnica.
   *  Sin especificar, se mantiene el radio actual de producción — cero cambio
   *  visual en la página real del evento. */
  cornerStyle?: "rounded" | "sharp";
}) {
  // Si la URL del flyer 404ea o falla la carga (link roto, storage caído),
  // no queremos el ícono de imagen rota del navegador ocupando el marco —
  // se trata igual que "sin flyer": cae al gradiente de marca.
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const hasCover = Boolean(event.coverUrl) && !imgFailed;
  // El navegador no re-dispara `onLoad` en un <img> que se monta ya
  // completo (imagen servida desde cache HTTP/memoria) — sin este chequeo
  // en el ref el flyer queda atascado en opacity-0 detrás del skeleton.
  // Si ya estaba en cache, además se salta el fade: no tiene sentido animar
  // una imagen que nunca estuvo realmente ausente.
  const skipFadeRef = useRef(false);
  const imgRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) {
      skipFadeRef.current = true;
      setImgLoaded(true);
    }
  }, []);
  const immersive = variant === "immersive";
  const dt = eventDatePillParts(event.startsAt, event.timezone);
  const sharp = cornerStyle === "sharp";

  return (
    <div
      className={
        "relative w-full overflow-hidden border border-cart-line bg-cart-bg-elev " +
        (sharp ? "rounded-[4px]" : "rounded-[24px] lg:rounded-[28px]")
      }
    >
      {hasCover ? (
        // Inmersivo: el propio flyer difuminado baña toda la cabecera con su
        // color (Posh). Ticket: apenas un tinte, el póster manda en card clara.
        <div
          className={
            "absolute inset-0 scale-110 bg-cover bg-center blur-2xl " +
            (immersive ? "opacity-80 saturate-150" : "opacity-30 saturate-125")
          }
          style={{
            backgroundImage: `url("${optimizeImageUrl(event.coverUrl, "hero-blur") ?? event.coverUrl}")`,
          }}
        />
      ) : (
        // Sin flyer (o falló la carga): degradado con la marca DEL
        // ORGANIZADOR (brandColor), no el morado de Pasape — si no eligió
        // uno, ese morado queda como default razonable, no como "la única
        // identidad posible" para quien no subió flyer.
        <div
          className="absolute inset-0"
          style={{
            background: (() => {
              const { dark, mid, accent } = derivePalette(orgBrandColor || "#7C3AED");
              return `linear-gradient(140deg, ${dark} 0%, ${mid} 45%, ${accent} 90%)`;
            })(),
          }}
        />
      )}
      {/* Scrim: en ticket es claro (mantiene el marco en la paleta clara);
          en inmersivo es oscuro y sutil, para dar profundidad sin apagar el color. */}
      <div
        className="absolute inset-0"
        style={{
          background: immersive
            ? "linear-gradient(180deg, rgba(12,7,20,0.12) 0%, rgba(12,7,20,0) 42%, rgba(12,7,20,0.28) 100%)"
            : "linear-gradient(180deg, rgba(251,250,255,0.4) 0%, rgba(251,250,255,0) 32%, rgba(251,250,255,0.6) 100%)",
        }}
      />

      <div className={"relative w-full " + (hasCover ? "" : "aspect-[16/10]")}>
        {hasCover && (
          // Contenedor con la MISMA proporción de referencia que la imagen
          // (4:5, la típica de un flyer vertical) + el mismo max-w/max-h que
          // antes vivían en el <img>: reserva exactamente el espacio final
          // desde el primer render, así el skeleton de abajo ocupa el mismo
          // rectángulo que la imagen real y no hay salto/rebote al cargar —
          // solo un fundido de opacidad cuando `onLoad` dispara.
          <div
            className="relative z-[1] mx-auto max-w-[calc(100%-2.5rem)] max-h-[52vh] my-5 lg:my-7 lg:max-w-[calc(100%-3.5rem)]"
            style={{ aspectRatio: "864 / 1080" }}
          >
            {!imgLoaded && (
              <div
                aria-hidden
                className={"absolute inset-0 animate-pulse bg-cart-bg-elev-2 " + (sharp ? "rounded-[4px]" : "rounded-[20px]")}
              />
            )}
            {/* Nítida → preset propio "event-hero" (más ancho que el "hero-lcp"
                del carrusel del home: este flyer se ve mucho más grande, sobre
                todo en desktop, y con "hero-lcp" se vería pixelado). Si falla
                la carga, `onError` desmonta el <img> y cae al gradiente de
                marca (evita el ícono roto). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={optimizeImageUrl(event.coverUrl, "event-hero") ?? event.coverUrl ?? undefined}
              alt={event.title}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
              className={
                "size-full object-contain " +
                (sharp ? "rounded-[4px] " : "rounded-[20px] ") +
                (skipFadeRef.current ? "" : "transition-opacity duration-300 ") +
                (imgLoaded ? "opacity-100" : "opacity-0")
              }
              style={{
                filter: immersive
                  ? "drop-shadow(0 18px 44px rgba(0,0,0,0.5))"
                  : "drop-shadow(0 8px 22px rgba(40,20,90,0.18))",
              }}
            />
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-5">
          <BackButton />
          <div className="flex items-center gap-2">
            <SaveEventButton eventId={eventId} />
            <ShareButton title={event.title} />
          </div>
        </div>
      </div>

      {/* Talón del ticket: el póster, el NOMBRE y los datos son un solo objeto
          (una entrada física completa). Corte perforado + título + fecha +
          precio. Solo en la variante "ticket" — el título grande de abajo se
          oculta para no repetirlo. */}
      {variant === "ticket" && hasCover && (
        <div className="relative">
          {/* Perforación: círculos centrados en el borde — la mitad de afuera la
              recorta el overflow-hidden de la card, dejando la muesca. */}
          <span className="absolute left-0 top-0 z-[2] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cart-bg" />
          <span className="absolute right-0 top-0 z-[2] size-4 translate-x-1/2 -translate-y-1/2 rounded-full bg-cart-bg" />
          <span className="absolute inset-x-4 top-0 -translate-y-1/2 border-t-2 border-dashed border-cart-line-strong" />
          <div
            className="px-5 py-4"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-cart-accent) 6%, var(--color-cart-bg-elev)) 0%, var(--color-cart-bg-elev) 100%)",
            }}
          >
            <h1 className="text-[20px] font-bold leading-[1.14] tracking-[-0.02em] text-cart-ink sm:text-[23px] lg:text-[27px]">
              {event.title}
            </h1>
            <div className="mt-3 flex items-center gap-4">
              <div className="text-center leading-none">
                <div className="text-[26px] font-extrabold tracking-[-0.03em] text-cart-ink">
                  {dt.day}
                </div>
                <div className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-cart-accent">
                  {dt.month}
                </div>
              </div>
              <div className="h-9 w-px bg-cart-line-strong" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold tracking-[-0.01em] text-cart-ink">
                  {dt.weekday} · {dt.time}
                </div>
                {event.venue && (
                  <div className="mt-0.5 truncate text-[11.5px] text-cart-ink-3">{event.venue}</div>
                )}
              </div>
              {fromPriceCents != null && (
                <div className="text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-cart-ink-4">
                    Desde
                  </div>
                  <div className="text-[15px] font-bold tracking-[-0.02em] text-cart-ink">
                    {fromPriceCents <= 0 ? "Gratis" : formatMoney(fromPriceCents, "PEN")}
                  </div>
                </div>
              )}
            </div>
            {isClosed && <EndedBadge />}
          </div>
        </div>
      )}
    </div>
  );
}

// Botón de chrome sobre el flyer: blanco SÓLIDO (nada de translúcido + blur, que
// funcionaba como vidrio esmerilado y absorbía el morado/magenta del flyer) +
// sombra y ring para separarlo. Contrasta sobre cualquier flyer sin teñirse.
const HERO_BTN =
  "grid size-10 place-items-center rounded-full bg-white text-cart-ink shadow-[0_4px_14px_-3px_rgba(45,25,90,0.28)] ring-1 ring-black/[0.03] transition hover:bg-white/95";

function BackButton() {
  const router = useRouter();
  // El historial del navegador no existe en el servidor — arrancar en `false`
  // (igual que SSR) y recién resolver el valor real tras montar evita el
  // mismatch de hidratación (icono/aria-label distintos entre server y cliente).
  const [hasHistory, setHasHistory] = useState(false);
  useEffect(() => {
    setHasHistory(window.history.length > 1);
  }, []);
  const handleBack = () => {
    if (hasHistory) {
      router.back();
    } else {
      router.push("/");
    }
  };
  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={hasHistory ? "Volver" : "Inicio"}
      className={HERO_BTN}
    >
      {hasHistory ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 6.5L8 2l6 4.5V14a.5.5 0 01-.5.5h-4V10h-3v4.5h-4A.5.5 0 012 14V6.5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

// Invitado → abre el SignInDrawer sin salir de la página; al loguear, el
// evento se guarda solo (mismo patrón que "Seguir" en FollowButton).
function SaveEventButton({ eventId }: { eventId: string }) {
  const { isSaved, toggle, isPending } = useSaveEvent(eventId);
  const handleToggle = () => {
    clientEvents.eventSaved({ event_id: eventId, saved: !isSaved });
    toggle();
  };
  const gate = useAuthGatedAction("save", eventId, handleToggle, () => {
    if (!isSaved) handleToggle();
  });

  return (
    <>
      <button
        type="button"
        onClick={() => gate.run()}
        disabled={isPending}
        aria-label={isSaved ? "Quitar de favoritos" : "Guardar en favoritos"}
        aria-pressed={isSaved}
        className={HERO_BTN + " active:scale-90 disabled:opacity-60"}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 18 18"
          fill={isSaved ? "var(--color-cart-accent)" : "none"}
          className={isSaved ? "text-cart-accent" : "text-cart-ink"}
          aria-hidden
        >
          <path
            d="M9 15.5s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <SignInDrawer
        open={gate.signInOpen}
        onClose={gate.closeDrawer}
        redirectTo={gate.redirectTo}
      />
    </>
  );
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
        clientEvents.eventShared({ method: "native_share" });
      } catch {
        /* user cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(window.location.href);
      clientEvents.eventShared({ method: "clipboard" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onShare}
        aria-label="Compartir evento"
        className={HERO_BTN}
      >
        {/* Icono de compartir universal (nodos conectados) — más claro que el
            glifo iOS (caja + flecha), que muchos no reconocen. */}
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
          <circle cx="13.5" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="4.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="13.5" cy="14" r="2.2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.4 7.9l5-2.8M6.4 10.1l5 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {copied && (
        <div className="absolute top-12 right-0 animate-in fade-in slide-in-from-top-2 duration-200 whitespace-nowrap rounded-lg bg-white/95 px-3 py-1.5 text-[12px] font-medium text-gray-900 shadow-lg backdrop-blur-sm">
          Copiado en portapapeles
        </div>
      )}
    </div>
  );
}

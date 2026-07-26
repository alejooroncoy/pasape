"use client";

import { Link } from "@/i18n/navigation";
import { useBrowseEvents } from "@/lib/events/hooks/useEvents";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { useSaveEvent } from "@/lib/identity/hooks/useSaveEvent";
import { shortEventDate as shortDay } from "@/lib/_shared/format";
import type { EventCard as EventCardType, EventCategory } from "@/server/events/domain/Event";
import { CATEGORIES } from "./categories";
import { splitFeatured } from "./featured";

// Un solo lugar: el título vive en las dos ramas del encabezado (panel del home
// y página completa) y un cambio de copy tenía que acordarse de tocar ambas.
const SECTION_TITLE = "Próximos en Lima";

// Corazón para guardar el evento — botón fantasma en el pie de la card (como
// Joinnus), no flotando sobre el flyer. Hermano del Link para no anidar
// <button> dentro de <a>. Para invitados el toggle no persiste.
function SaveHeart({ eventId }: { eventId: string }) {
  const { isSaved, toggle, isPending } = useSaveEvent(eventId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={isPending}
      aria-label={isSaved ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={isSaved}
      /* 40 px de target sobre el flyer (antes 32) y tokens en vez de literales:
         el corazón se reusa en cualquier scope, no solo sobre fondo claro. */
      className="absolute right-2 top-2 z-10 grid size-10 place-items-center rounded-full bg-cart-bg shadow-[0_2px_10px_rgba(20,10,60,0.25)] transition hover:scale-105 active:scale-90 disabled:opacity-60"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 18 18"
        fill={isSaved ? "currentColor" : "none"}
        className={isSaved ? "text-cart-accent" : "text-cart-ink-2"}
        aria-hidden
      >
        <path
          d="M9 15.5s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[14px] border border-cart-line bg-cart-bg-elev">
      <div className="w-full animate-pulse bg-cart-bg-elev-2" style={{ aspectRatio: "3/4" }} />
      <div className="space-y-2 p-3">
        <div className="h-3 w-1/2 animate-pulse rounded bg-cart-bg-elev-2" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-cart-bg-elev-2" />
      </div>
    </div>
  );
}

// Anatomía de card de ticketera al detalle (Joinnus): flyer limpio arriba,
// y debajo chips de fecha y ciudad con icono, título, lugar, y el corazón
// como botón fantasma en el pie — nada flotando sobre el flyer.
function EventCard({ event }: { event: EventCardType }) {
  return (
    <div className="group relative">
      <SaveHeart eventId={event.id} />
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={`/events/${event.slug}` as any}
        className="block cursor-pointer overflow-hidden rounded-[14px] border border-cart-line bg-cart-bg-elev transition-[border-color,transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:border-cart-line-strong group-hover:shadow-[0_10px_28px_-12px_rgba(20,10,60,0.25)]"
      >
        <div className="card-media relative w-full overflow-hidden aspect-[3/4]">
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={optimizeImageUrl(event.coverUrl, "card") ?? event.coverUrl}
              alt={event.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 bg-cart-bg-elev-2" />
          )}
        </div>
        <div className="p-3 pb-3.5">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-[6px] border border-cart-accent/30 bg-cart-accent/[0.07] px-1.5 py-0.5 text-[10.5px] font-bold text-cart-accent">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden>
                <rect x="1.5" y="2.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M1.5 5.5h11M4.5 1.5v2M9.5 1.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {shortDay(event.startsAt, event.timezone)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-[6px] border border-cart-line px-1.5 py-0.5 text-[10.5px] font-semibold text-cart-ink-3">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M7 12.5S2.8 8.8 2.8 5.8a4.2 4.2 0 118.4 0c0 3-4.2 6.7-4.2 6.7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <circle cx="7" cy="5.8" r="1.4" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              Lima
            </span>
          </div>
          <p className="m-0 line-clamp-2 font-sans text-[14.5px] font-bold leading-snug tracking-[-0.01em] text-cart-ink">
            {event.title}
          </p>
          {event.venue && (
            <p className="m-0 mt-0.5 line-clamp-1 font-sans text-[12px] text-cart-ink-3">{event.venue}</p>
          )}
        </div>
      </Link>
    </div>
  );
}

type Props = {
  sectionRef?: React.RefObject<HTMLElement | null>;
  category: EventCategory | null;
  onCategoryChange: (cat: EventCategory | null) => void;
  search?: string;
  compactHeader?: boolean;
  /** true = se renderiza como panel dentro del layout de dos columnas del home
   *  (estilo Joinnus): card blanca redondeada con cabecera tipográfica de dos
   *  líneas, sin containers propios. false = página completa (rutas SEO). */
  framed?: boolean;
};

export function EventsSection({
  sectionRef,
  category,
  onCategoryChange,
  search,
  compactHeader = false,
  framed = false,
}: Props) {
  const events = useBrowseEvents(category);
  // Siempre traemos todos para saber qué categorías tienen al menos 1 evento
  const allEvents = useBrowseEvents(null);
  const categoriesWithEvents = new Set(
    (allEvents.data ?? []).map((e) => e.category).filter(Boolean),
  );
  const visibleCategories = CATEGORIES.filter((c) => categoriesWithEvents.has(c.id));

  const q = search?.trim().toLowerCase() ?? "";
  // Sin filtro activo, la grilla arranca donde termina el banner destacado
  // (`splitFeatured`): así el mismo evento no aparece dos veces seguidas. Con
  // categoría o búsqueda se muestran todos los que calzan — ahí esconder
  // resultados sería un bug, no un reparto.
  const base = category === null && !q ? splitFeatured(events.data ?? []).rest : events.data;
  const filtered = q
    ? (base ?? []).filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.venue?.toLowerCase().includes(q) ?? false),
      )
    : base;

  const body = (
    <>
      {/* Header + filtros */}
      <div className={framed ? "" : "mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]"}>
        <div className="mb-4 flex items-center justify-between">
          {framed ? (
            /* Caja normal + punto final en morado: firma tipográfica propia,
               sin el uppercase de template. Dice lo que la consulta devuelve
               (próximos), no un recorte semanal que nadie está aplicando. */
            <h2 className="m-0 font-sans text-[21px] font-bold tracking-[-0.02em] text-cart-ink">
              {SECTION_TITLE}<span className="text-cart-accent">.</span>
            </h2>
          ) : (
            <h2 className="m-0 font-sans text-[clamp(18px,2.4vw,28px)] font-semibold tracking-[-0.02em] text-cart-ink">
              {compactHeader ? "Disponibles ahora" : SECTION_TITLE}
            </h2>
          )}
          {!framed && (
            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={"/events" as any}
              className="text-[12.5px] font-medium text-cart-ink-3 transition-colors hover:text-cart-ink"
            >
              Ver todos →
            </Link>
          )}
        </div>

        {/* Pills de categoría — activo en morado SÓLIDO con texto blanco (como
            los filtros llenos de Joinnus/Teleticket), inactivo con hover
            azulito. Nada de rellenos lavanda a medias.
            En móvil (≤560px) se ocultan: ahí manda el strip sticky del header
            (MobileCategoryStrip, ubicación + categoría), y repetir el filtro
            por sección se lee como control roto/duplicado. En desktop el strip
            está oculto, así que estos pills son el único filtro y se muestran. */}
        <div className="flex flex-wrap gap-2 mb-5 max-[560px]:hidden">
          <button
            onClick={() => onCategoryChange(null)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 ${
              category === null
                ? "bg-cart-accent text-white shadow-[0_6px_16px_-6px_var(--color-cart-accent-glow-strong)]"
                : "border border-cart-line bg-cart-bg text-cart-ink-2 hover:border-cart-accent-2/50 hover:text-cart-ink"
            }`}
          >
            Todos
          </button>
          {visibleCategories.map(({ id, label, color }) => {
            const active = category === id;
            return (
              <button
                key={id}
                onClick={() => onCategoryChange(active ? null : id)}
                className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 ${
                  active ? "" : "border border-cart-line bg-cart-bg text-cart-ink-2 hover:text-cart-ink"
                }`}
                style={
                  active
                    ? {
                        background: color,
                        // Los colores de categoría son CLAROS (diseñados para
                        // fondo oscuro): texto oscuro para contraste, no blanco
                        // (mismo token que el strip móvil).
                        color: "var(--color-cart-ink-on-color)",
                        boxShadow: `0 6px 16px -6px ${color}99`,
                      }
                    : undefined
                }
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.borderColor = `${color}80`;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.borderColor = "";
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grilla de cards — patrón de listado de ticketera (Joinnus/Teleticket):
          grilla responsiva en vez de carrusel horizontal. */}
      <div
        className={
          // En móvil (2 col): si el total es IMPAR, la última card queda sola en
          // su fila → :last-child:nth-child(odd) la hace ocupar el ancho completo
          // (col-span-2) y su flyer pasa a apaisado (16/10) para mantener ~la
          // misma altura, no un portrait gigante. `max-sm` lo limita a móvil;
          // en 3/4 columnas (sm+) no aplica. Todo con CSS, sin JS.
          framed
            ? "grid grid-cols-2 gap-3 max-sm:[&>*:last-child:nth-child(odd)]:col-span-2 max-sm:[&>*:last-child:nth-child(odd)_.card-media]:aspect-[16/10] sm:grid-cols-3 sm:gap-4"
            : "mx-auto grid max-w-[1320px] grid-cols-2 gap-3 px-[clamp(20px,4vw,56px)] max-sm:[&>*:last-child:nth-child(odd)]:col-span-2 max-sm:[&>*:last-child:nth-child(odd)_.card-media]:aspect-[16/10] sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
        }
      >
        {events.isLoading && Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}

        {filtered?.map(event => (
          <EventCard key={event.id} event={event} />
        ))}

        {!events.isLoading && (filtered?.length ?? 0) === 0 && (
          /* El vacío es el mensaje principal de la pantalla: va en tinta
             legible (no en el gris de hint) y siempre ofrece una salida. */
          <div className="col-span-full py-10">
            {q ? (
              <p className="m-0 text-[14px] text-cart-ink-2">
                Nada que calce con <span className="font-semibold text-cart-ink">“{search?.trim()}”</span>.
              </p>
            ) : category ? (
              <p className="m-0 text-[14px] text-cart-ink-2">
                Todavía no hay eventos en esta categoría.{" "}
                <button
                  type="button"
                  onClick={() => onCategoryChange(null)}
                  className="font-semibold text-cart-accent-strong underline underline-offset-2"
                >
                  Ver todas
                </button>
              </p>
            ) : (
              <>
                <p className="m-0 text-[14px] text-cart-ink-2">
                  Todavía no hay eventos publicados.
                </p>
                <Link
                  href="/organizadores"
                  className="mt-1.5 inline-block text-[13.5px] font-semibold text-cart-accent-strong underline underline-offset-2"
                >
                  ¿Organizas eventos? Publica el tuyo
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (framed) {
    return (
      <section ref={sectionRef} className="min-w-0 scroll-mt-[96px] sm:scroll-mt-[80px]">
        <div className="rounded-[18px] border border-cart-line bg-cart-bg-elev/50 p-4 sm:p-5">{body}</div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className={`scroll-mt-[96px] sm:scroll-mt-[80px] ${compactHeader ? "pt-3 pb-[clamp(32px,4vw,56px)]" : "pt-[clamp(20px,3vw,32px)] pb-[clamp(32px,4vw,56px)]"}`}
    >
      {body}
    </section>
  );
}

"use client";

import { Link } from "@/i18n/navigation";
import { useBrowseEvents } from "@/lib/events/hooks/useEvents";
import type { Event, EventCategory } from "@/server/events/domain/Event";
import { CATEGORIES } from "./categories";

const shortDay = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("es-PE", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

function CardSkeleton() {
  return (
    <div className="flex-shrink-0" style={{ width: "clamp(170px,20vw,240px)" }}>
      <div className="w-full animate-pulse rounded-[16px] bg-cart-bg-elev" style={{ aspectRatio: "3/4" }} />
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      href={`/events/${event.slug}` as any}
      className="group flex-shrink-0 cursor-pointer"
      style={{ width: "clamp(170px,20vw,240px)", scrollSnapAlign: "start" }}
    >
      <div
        className="relative w-full overflow-hidden rounded-[16px] border border-white/[0.07] transition-colors duration-200 group-hover:border-white/[0.18]"
        style={{ aspectRatio: "3/4" }}
      >
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(150deg,#0f0020 0%,#3b0764 40%,#7c3aed 100%)" }}
          />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(4,4,8,0.88) 0%, transparent 50%)" }}
        />
        <div className="absolute left-[10px] top-[10px] rounded-full border border-white/[0.08] bg-black/50 px-[9px] py-[4px] text-[10px] font-semibold text-white/80 backdrop-blur-md">
          {shortDay(event.startsAt, event.timezone)}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-[12px]">
          <p className="m-0 mb-[2px] font-sans text-[14px] font-bold leading-snug tracking-[-0.02em] text-white">
            {event.title}
          </p>
          {event.venue && (
            <p className="m-0 font-sans text-[11px] text-white/45">{event.venue}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

type Props = {
  sectionRef?: React.RefObject<HTMLElement | null>;
  category: EventCategory | null;
  onCategoryChange: (cat: EventCategory | null) => void;
  search?: string;
};

export function EventsSection({ sectionRef, category, onCategoryChange, search }: Props) {
  const events = useBrowseEvents(category);
  const q = search?.trim().toLowerCase() ?? "";
  const filtered = q
    ? (events.data ?? []).filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.venue?.toLowerCase().includes(q) ?? false),
      )
    : events.data;

  return (
    <section ref={sectionRef} className="pt-[clamp(48px,6vw,80px)] pb-[clamp(32px,4vw,56px)]">
      {/* Header + filtros */}
      <div className="mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 font-sans text-[clamp(18px,2.4vw,28px)] font-semibold tracking-[-0.02em] text-white/85">
            Esta semana
          </h2>
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={"/events" as any}
            className="text-[12.5px] font-medium text-white/35 transition-colors hover:text-white/65"
          >
            Ver todos →
          </Link>
        </div>

        {/* Pills de categoría — dentro del header, directamente sobre las cards */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => onCategoryChange(null)}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150 ${
              category === null
                ? "border-cart-accent bg-cart-accent/15 text-white"
                : "border-cart-line bg-transparent text-white/45 hover:text-white/70 hover:border-white/20"
            }`}
          >
            Todos
          </button>
          {CATEGORIES.map(({ id, label, color }) => {
            const active = category === id;
            return (
              <button
                key={id}
                onClick={() => onCategoryChange(active ? null : id)}
                className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150"
                style={{
                  borderColor: active ? color : "var(--color-cart-line)",
                  background: active ? `${color}26` : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.45)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scroll de cards */}
      <div
        className="flex gap-3 overflow-x-auto"
        style={{
          paddingLeft: "calc(clamp(20px, 4vw, 56px) + max(0px, (100vw - 1320px) / 2))",
          paddingRight: "clamp(20px, 4vw, 56px)",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        {events.isLoading && Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}

        {filtered?.map(event => (
          <EventCard key={event.id} event={event} />
        ))}

        {!events.isLoading && (filtered?.length ?? 0) === 0 && (
          <p className="py-12 text-[13px] text-white/30">
            {q ? `Sin resultados para "${search}"` : "Pronto habrá eventos."}
          </p>
        )}

        <div className="flex-shrink-0" style={{ width: "clamp(20px,4vw,56px)" }} />
      </div>
    </section>
  );
}

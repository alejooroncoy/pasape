import { Link } from "@/i18n/navigation";
import type { Event } from "@/server/events/domain/Event";

const shortDay = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("es-PE", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));

type Props = {
  events: Event[];
  emptyMessage?: string;
};

export function EventosGrid({ events, emptyMessage = "No hay eventos publicados por ahora." }: Props) {
  if (events.length === 0) {
    return (
      <p className="mt-8 text-[15px] leading-relaxed text-cart-ink-3">{emptyMessage}</p>
    );
  }

  return (
    <ul className="mt-8 grid list-none grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4 p-0 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={`/events/${event.slug}` as any}
            className="group block"
          >
            <article className="overflow-hidden rounded-[16px] border border-white/[0.07] transition-colors duration-200 group-hover:border-white/[0.18]">
              <div className="relative w-full" style={{ aspectRatio: "3/4" }}>
                {event.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.coverUrl}
                    alt={event.title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(150deg,#0f0020 0%,#3b0764 40%,#7c3aed 100%)",
                    }}
                    aria-hidden
                  />
                )}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(4,4,8,0.96) 0%, rgba(4,4,8,0.7) 35%, rgba(4,4,8,0.15) 60%, transparent 80%)",
                  }}
                  aria-hidden
                />
                <div className="absolute left-[10px] top-[10px] rounded-full border border-white/[0.08] bg-black/50 px-[9px] py-[4px] text-[10px] font-semibold text-white/80 backdrop-blur-md">
                  {shortDay(event.startsAt, event.timezone)}
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-[12px]">
                  <h2 className="m-0 mb-[2px] font-sans text-[14px] font-bold leading-snug tracking-[-0.02em] text-white">
                    {event.title}
                  </h2>
                  {event.venue && (
                    <p className="m-0 font-sans text-[11px] text-white/65">{event.venue}</p>
                  )}
                </div>
              </div>
            </article>
          </Link>
        </li>
      ))}
    </ul>
  );
}

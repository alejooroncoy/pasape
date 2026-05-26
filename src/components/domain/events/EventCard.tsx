import { Link } from "@/i18n/navigation";
import type { Event } from "@/server/events/domain/Event";
import { formatDate } from "@/lib/_shared/format";

export const EventCard = ({ event }: { event: Event }) => (
  <Link
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    href={`/events/${event.slug}` as any}
    className="flex flex-col gap-2 overflow-hidden rounded-3xl border border-(--color-border) bg-(--color-bg-card) hover:border-(--color-accent)"
  >
    <div className="aspect-[3/2] w-full bg-(--color-bg-elevated)">
      {event.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverUrl} alt={event.title} className="h-full w-full object-cover" />
      )}
    </div>
    <div className="flex flex-col gap-1 px-4 pb-4 pt-2">
      <h3 className="text-base font-semibold">{event.title}</h3>
      <p className="text-xs text-(--color-fg-muted)">
        {formatDate(event.startsAt, event.timezone)} · {event.venue ?? ""}
      </p>
    </div>
  </Link>
);

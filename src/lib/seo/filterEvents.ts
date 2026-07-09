import type { Event } from "@/server/events/domain/Event";

export function filterEventsByQuery(events: Event[], query: string | undefined): Event[] {
  const q = query?.trim().toLowerCase();
  if (!q) return events;
  return events.filter(
    (ev) =>
      ev.title.toLowerCase().includes(q) ||
      ev.venue?.toLowerCase().includes(q) ||
      ev.description?.toLowerCase().includes(q),
  );
}

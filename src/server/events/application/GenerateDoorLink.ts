import type { Event } from "../domain/Event";

export type DoorLink = {
  url: string;
  code: string;
  expiresAt: string;
};

// Door link: short opaque code per event. Real impl would persist a one-time token in DB.
// For now we derive a deterministic code from the slug + a short rotation hour bucket so
// the same organizer regenerates the same link within an hour but can rotate it.
export const generateDoorLink = (event: Pick<Event, "slug">, origin: string): DoorLink => {
  const hour = Math.floor(Date.now() / (1000 * 60 * 60));
  const seed = `${event.slug}-${hour.toString(36)}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  const code = Math.abs(hash).toString(36).slice(0, 6);
  const url = `${origin.replace(/\/$/, "")}/scan?door=${event.slug}-${code}`;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
  return { url, code: `${event.slug}-${code}`, expiresAt };
};

// Recuerda de dónde entró el organizador al detalle de un evento, para que el
// breadcrumb "‹ …" lo devuelva al mismo lugar (home vs lista de eventos).
// La navegación es SPA (Link), así que document.referrer no sirve: guardamos
// el origen al hacer click y lo leemos en EventShell.
export type EventBackTarget = { href: string; label: string };

const KEY = "pasape:event-back";
const DEFAULT: EventBackTarget = { href: "/org/events", label: "Eventos" };

export function setEventBackTarget(t: EventBackTarget) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // sessionStorage no disponible (SSR/incógnito): ignoramos.
  }
}

export function getEventBackTarget(): EventBackTarget {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as EventBackTarget;
  } catch {
    // ignoramos y caemos al default
  }
  return DEFAULT;
}

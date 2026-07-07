import type { EventStatus } from "@/server/events/domain/Event";

/**
 * Único lugar que enumera los EventStatus posibles y decide su copy/color.
 * `Record<EventStatus,...>` (no `Record<string,...>`) obliga a TypeScript a
 * fallar la build si se agrega un status nuevo al dominio sin decidir acá su
 * label y tono — antes había 4 copias de este mapeo (EventCard, EventShell,
 * OrgHomeClient, ExportEventReport) y cada una podía olvidarse de un status
 * por separado (ver PR #77: "pending_review" faltaba en 2 de las 4).
 */
export type EventStatusTone = "neutral" | "success" | "warning" | "danger";

type EventStatusInfo = { label: string; tone: EventStatusTone };

const EVENT_STATUS: Record<EventStatus, EventStatusInfo> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_review: { label: "En revisión", tone: "warning" },
  published: { label: "Publicado", tone: "success" },
  closed: { label: "Cerrado", tone: "neutral" },
  cancelled: { label: "Cancelado", tone: "danger" },
};

// TS garantiza en compile-time que `status` es una de las 5 keys de arriba,
// pero eso no lo valida nadie en runtime: `api-client.ts` castea la respuesta
// HTTP con `as T` sin verificar, y la DB solo lo restringe con un CHECK
// constraint que puede quedar desincronizado del enum TS durante un deploy
// (ver memoria "Drift Supabase remoto↔local" — ya un incidente real en este
// proyecto). Antes de este módulo, cada copia tenía su propio fallback ante
// un status desconocido ("—", el status crudo); sin fallback acá, un dato
// viejo/desincronizado tumba el render entero en vez de degradar.
const FALLBACK: EventStatusInfo = { label: "—", tone: "neutral" };
const infoFor = (status: EventStatus): EventStatusInfo => EVENT_STATUS[status] ?? FALLBACK;

export const eventStatusLabel = (status: EventStatus): string => infoFor(status).label;

export const eventStatusTone = (status: EventStatus): EventStatusTone => infoFor(status).tone;

/** Evento ya no activo (cerrado o cancelado) — solo para tratamientos visuales
 *  tipo atenuar/escala de grises, no para lógica de negocio. */
export const isEventOver = (status: EventStatus): boolean =>
  status === "closed" || status === "cancelled";

/** Clases Tailwind para un pill con fondo/borde/texto tintado según el tono del status. */
const TONE_PILL_CLASSNAME: Record<EventStatusTone, string> = {
  neutral: "border-cart-line bg-cart-bg-elev-2 text-cart-ink-3",
  success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  warning: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  danger: "border-rose-400/30 bg-rose-500/10 text-rose-300",
};

export const eventStatusPillClassName = (status: EventStatus): string =>
  TONE_PILL_CLASSNAME[eventStatusTone(status)];

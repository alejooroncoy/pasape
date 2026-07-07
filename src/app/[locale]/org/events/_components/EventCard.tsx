"use client";

import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/_shared/format";
import { setEventBackTarget } from "@/lib/_shared/eventBackTarget";
import { eventStatusLabel, eventStatusPillClassName } from "@/lib/events/eventStatusDisplay";
import type { Event } from "@/server/events/domain/Event";

type Variant = "upcoming" | "past" | "draft";

// Copy propio del tab activo (no del status crudo): dentro de "upcoming" solo
// caen eventos published, y "Finalizado"/"Borrador" son más suaves que los
// labels genéricos de eventStatusDisplay para este contexto de lista.
const STATUS_CONFIG: Record<Variant, { label: string; className: string }> = {
  upcoming: {
    label: "Publicado",
    className: "bg-emerald-300/10 text-emerald-300 border-emerald-300/20",
  },
  past: {
    label: "Finalizado",
    className: "bg-white/5 text-cart-ink-4 border-cart-line",
  },
  draft: {
    label: "Borrador",
    className: "bg-white/5 text-cart-ink-3 border-cart-line",
  },
};

export function EventCard({ event, variant }: { event: Event; variant: Variant }) {
  // Un evento cancelado o en revisión no encaja en el variant del tab activo
  // (ambos caen en "upcoming" vía classifyEvent): distinguirlos por su status
  // real, con label/color de la fuente única (eventStatusDisplay).
  const status =
    event.status === "cancelled" || event.status === "pending_review"
      ? { label: eventStatusLabel(event.status), className: eventStatusPillClassName(event.status) }
      : STATUS_CONFIG[variant];
  const sold = event.listStats?.sold ?? 0;
  const capacity = event.listStats?.capacity ?? event.capacity?.totalCapacity ?? 0;
  const pct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      whileHover={{ borderColor: "var(--color-cart-accent)" }}
      transition={{ type: "spring", damping: 22, stiffness: 320 }}
      className="group rounded-2xl border border-cart-line bg-cart-bg-elev overflow-hidden active:bg-white/[0.02]"
    >
      <Link
        href={`/org/events/${event.slug}` as never}
        onClick={() => setEventBackTarget({ href: "/org/events", label: "Eventos" })}
        className="flex h-full"
      >
        {/* Mobile: row layout with side thumbnail. Desktop (sm+): stacked card. */}
        <div
          className="relative h-auto w-28 flex-shrink-0 self-stretch overflow-hidden sm:hidden"
          style={{
            background: event.coverUrl
              ? `url(${event.coverUrl}) center/cover`
              : "linear-gradient(135deg, #2a1547 0%, #6d28d9 50%, #b87cff 100%)",
          }}
          aria-hidden={!!event.coverUrl}
        >
          {!event.coverUrl && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18), transparent 50%)",
              }}
            />
          )}
        </div>

        <div className="hidden flex-col sm:flex sm:flex-1">
          {/* Cover for desktop */}
          <div
            className="relative h-32 w-full overflow-hidden"
            style={{
              background: event.coverUrl
                ? `url(${event.coverUrl}) center/cover`
                : "linear-gradient(135deg, #2a1547 0%, #6d28d9 50%, #b87cff 100%)",
            }}
          >
            {!event.coverUrl && (
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.18), transparent 50%)",
                }}
              />
            )}
            <div className="absolute right-3 top-3">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium backdrop-blur-md ${status.className}`}
              >
                {status.label}
              </span>
            </div>
          </div>

          {/* Body desktop */}
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-white">
                {event.title}
              </h3>
              <p className="mt-1 text-[12.5px] text-cart-ink-3">
                {formatDate(event.startsAt, event.timezone)}
              </p>
              {event.venue && (
                <p className="mt-0.5 truncate text-[12.5px] text-cart-ink-4">
                  {event.venue}
                </p>
              )}
            </div>

            <div className="mt-auto space-y-1.5">
              <div className="flex items-center justify-between text-[11.5px] text-cart-ink-3">
                <span>
                  {sold}{" "}
                  <span className="text-cart-ink-4">
                    / {capacity || "—"} vendidos
                  </span>
                </span>
                <span className="text-cart-ink-4">{pct}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-cart-accent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile body */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3.5 sm:hidden">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <h3 className="line-clamp-2 text-[15.5px] font-semibold leading-tight tracking-[-0.01em] text-white">
              {event.title}
            </h3>
            <p className="mt-1 text-[12.5px] text-cart-accent">
              {formatDate(event.startsAt, event.timezone)}
            </p>
            {event.venue && (
              <p className="mt-0.5 truncate text-[12px] text-cart-ink-4">
                {event.venue}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full bg-cart-accent"
              />
            </div>
            <span className="text-[11px] tabular-nums text-cart-ink-4">
              {sold}/{capacity || "—"}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function EventCardSkeleton() {
  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      className="flex overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev sm:block"
    >
      <div className="h-auto w-28 flex-shrink-0 bg-white/[0.04] sm:h-32 sm:w-full" />
      <div className="hidden space-y-3 p-4 sm:block">
        <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
        <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
        <div className="h-1 w-full rounded-full bg-white/[0.04]" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2 p-3.5 sm:hidden">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded-full bg-white/[0.06]" />
          <div className="h-4 w-3/4 rounded bg-white/[0.06]" />
          <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
        </div>
        <div className="h-1 w-full rounded-full bg-white/[0.04]" />
      </div>
    </motion.div>
  );
}

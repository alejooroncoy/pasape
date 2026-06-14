"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "motion/react";
import { useMyEvents } from "@/lib/events/hooks/useEvents";
import { useEventStats } from "@/lib/events/hooks/useEventStats";
import { useRealtimeEventStats } from "@/lib/events/hooks/useRealtimeEventStats";
import { formatMoney } from "@/lib/_shared/format";
import { OrgShell } from "../_shell/OrgShell";
import type { Event, TicketTypeKind } from "@/server/events/domain/Event";

type RangeKey = "today" | "7d" | "30d" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "Todo" },
];

/**
 * Pick the most recent published event (fallback to first draft) as the default
 * focus for the per-event report. The brief: published > newest > first draft.
 */
function pickDefaultEvent(events: Event[] | undefined): Event | null {
  if (!events || events.length === 0) return null;
  const sorted = [...events].sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
  const published = sorted.find((e) => e.status === "published");
  if (published) return published;
  return sorted[0] ?? null;
}

function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-PE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function OrgReportsPage() {
  const events = useMyEvents();
  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("7d");

  // Default to most-recent published (or first draft) once events load.
  useEffect(() => {
    if (eventSlug) return;
    const def = pickDefaultEvent(events.data);
    if (def) setEventSlug(def.slug);
  }, [events.data, eventSlug]);

  const selectedEvent =
    events.data?.find((e) => e.slug === eventSlug) ?? null;

  const stats = useEventStats(eventSlug ?? "");
  const data = stats.data;
  // Refresca el reporte al instante ante ventas/scans (Broadcast desde DB).
  useRealtimeEventStats(selectedEvent?.id, eventSlug ?? "");

  const kpis = useMemo(() => {
    const revenue = data?.revenueCents ?? 0; // céntimos — formatMoney divide /100
    const sold = data?.sold ?? 0;
    const reserved = data?.reserved ?? 0;
    const validated = data?.validated ?? 0;
    const capacity = data?.capacity ?? 0;
    const conversion = capacity > 0 ? Math.min(100, (sold / capacity) * 100) : 0;
    return { revenue, sold, reserved, validated, conversion };
  }, [data]);

  const series = useMemo(
    () => buildSeries(data?.salesSeries ?? [], range),
    [data?.salesSeries, range],
  );

  // Empty state when the org has zero events at all.
  const hasNoEvents = events.isFetched && (events.data?.length ?? 0) === 0;

  return (
    <OrgShell>
      {/* Large title — iOS-style eyebrow + display */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:mb-6">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cart-ink-3">
            Panel
          </div>
          <h1 className="mt-1 font-sans text-[clamp(34px,7.2vw,42px)] font-bold leading-[1.05] tracking-[-0.035em] text-white">
            Reportes
          </h1>
          <p className="mt-1.5 truncate text-[13px] text-cart-ink-3">
            {selectedEvent
              ? `${selectedEvent.title} · ${formatEventDate(selectedEvent.startsAt)}`
              : hasNoEvents
                ? "Crea tu primer evento para empezar a medir"
                : "Selecciona un evento para ver su reporte"}
          </p>
        </div>
        <ExportButton
          slug={eventSlug}
          disabled={!eventSlug || hasNoEvents}
        />
      </div>

      {hasNoEvents ? (
        <NoEventsEmpty />
      ) : (
        <>
          {/* Filters — event selector is the protagonist */}
          <section className="mb-5 flex flex-col gap-2.5 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <EventSelector
              value={eventSlug}
              onChange={setEventSlug}
              events={events.data ?? []}
            />
            <RangeTabs value={range} onChange={setRange} />
          </section>

          {/* KPI grid */}
          <section className="mb-5 grid grid-cols-2 gap-2.5 sm:mb-6 sm:gap-3 lg:grid-cols-4">
            <KpiCard
              index={0}
              label="Recaudado"
              value={kpis.revenue}
              format={(v) => formatMoney(v)}
              delta={null}
              tone="accent"
            />
            <KpiCard
              index={1}
              label="Tickets vendidos"
              value={kpis.sold}
              format={(v) => v.toLocaleString("es-PE")}
              delta={null}
              subnote={
                kpis.reserved > 0
                  ? `${kpis.reserved} reservada${kpis.reserved === 1 ? "" : "s"}`
                  : undefined
              }
            />
            <KpiCard
              index={2}
              label="Validados"
              value={kpis.validated}
              format={(v) => v.toLocaleString("es-PE")}
              delta={null}
              tone="green"
            />
            <KpiCard
              index={3}
              label="Aforo cubierto"
              value={kpis.conversion}
              format={(v) => `${v.toFixed(1)}%`}
              delta={null}
            />
          </section>

          {/* Top promoters — protagonist section (feature 1) */}
          <section className="mb-5 rounded-2xl border border-cart-line bg-cart-bg-elev p-4 sm:mb-6 sm:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-accent">
                  Origen de venta
                </div>
                <h2 className="mt-1 font-sans text-[18px] font-semibold tracking-[-0.015em] text-white">
                  Top promotores
                </h2>
                <p className="mt-0.5 text-[12.5px] text-cart-ink-3">
                  Cada link de promotor trae su origen — aquí ves quién genera
                  qué.
                </p>
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-cart-ink-4">
                {(data?.byPromoter ?? []).filter((p) => p.ticketsSold > 0).length} con ventas
              </span>
            </div>
            <PromotersTable
              loading={stats.isLoading}
              rows={data?.byPromoter ?? []}
            />
          </section>

          {/* Chart */}
          <section className="mb-5 rounded-2xl border border-cart-line bg-cart-bg-elev p-4 sm:mb-6 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-sans text-[15.5px] font-semibold tracking-[-0.01em] text-white">
                  Ventas en el tiempo
                </h2>
                <p className="mt-0.5 text-[12.5px] text-cart-ink-3">
                  {series.some((v) => v > 0)
                    ? "Evolución de tickets vendidos"
                    : "Aún sin ventas — los datos aparecerán aquí en vivo"}
                </p>
              </div>
              <div className="hidden items-center gap-2 text-[11.5px] text-cart-ink-3 sm:flex">
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent-glow)]"
                />
                Tickets
              </div>
            </div>
            {series.some((v) => v > 0) ? (
              <Sparkline data={series} range={range} />
            ) : (
              <SalesEmptyState />
            )}
          </section>

          {/* Breakdown by ticket type — agrupado por familia (Box, Mesa, etc.) */}
          <section className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4 sm:p-6">
            {(() => {
              const grouped = groupTicketRows(
                (data?.ticketTypes ?? []).map((t) => ({
                  name: t.name,
                  kind: t.kind,
                  price: t.priceCents, // céntimos — formatPriceRange usa formatMoney (/100)
                  sold: t.sold,
                  capacity: t.capacity,
                })),
              );
              return (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-sans text-[15.5px] font-semibold tracking-[-0.01em] text-white">
                      Por tipo de ticket
                    </h2>
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-cart-ink-4">
                      {grouped.length} {grouped.length === 1 ? "categoría" : "categorías"}
                    </span>
                  </div>
                  {grouped.length === 0 ? (
                    <TicketTypesEmpty />
                  ) : (
                    <TicketBreakdown rows={grouped} />
                  )}
                </>
              );
            })()}
          </section>
        </>
      )}

      {/* iOS safe-area bottom inset */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </OrgShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Filters                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

function EventSelector({
  value,
  onChange,
  events,
}: {
  value: string | null;
  onChange: (v: string) => void;
  events: { slug: string; title: string; status?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = events.find((e) => e.slug === value)?.title ?? "Selecciona evento";

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.985 }}
        className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-cart-line bg-cart-bg-elev px-3.5 py-2 text-[13.5px] font-medium text-white hover:border-cart-line-strong sm:w-auto sm:justify-start"
      >
        <span className="flex min-w-0 items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden className="flex-shrink-0">
            <rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9h14M7 3v4M13 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="truncate sm:max-w-[220px]">{selected}</span>
        </span>
        <motion.svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          aria-hidden
          className="flex-shrink-0 text-cart-ink-3"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </motion.svg>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-2xl border border-cart-line-strong bg-cart-bg-elev-2 p-1 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] sm:w-[280px]"
          >
            {events.length === 0 ? (
              <div className="px-3 py-2 text-[12.5px] text-cart-ink-4">Aún no tienes eventos</div>
            ) : (
              events.map((e) => (
                <DropdownItem
                  key={e.slug}
                  active={value === e.slug}
                  onClick={() => {
                    onChange(e.slug);
                    setOpen(false);
                  }}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate">{e.title}</span>
                    {e.status && (
                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.08em] ${
                          e.status === "published"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-white/5 text-cart-ink-3"
                        }`}
                      >
                        {e.status === "published" ? "Live" : e.status}
                      </span>
                    )}
                  </span>
                </DropdownItem>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropdownItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13.5px] transition-colors ${
        active ? "bg-cart-accent-soft text-white" : "text-cart-ink-2 hover:bg-cart-bg-elev"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {active && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="ml-2 flex-shrink-0">
          <path
            d="M3 7.5l2.8 2.8L11 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-cart-accent"
          />
        </svg>
      )}
    </button>
  );
}

function RangeTabs({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Rango temporal"
      className="relative inline-flex w-full items-center gap-0.5 rounded-full border border-cart-line bg-cart-bg-elev p-1 sm:w-auto sm:gap-1"
    >
      {RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(r.key)}
            className={`relative z-10 flex-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors sm:flex-none sm:px-3.5 ${
              active ? "text-white" : "text-cart-ink-3 hover:text-white"
            }`}
          >
            {active && (
              <motion.span
                layoutId="range-underline"
                className="absolute inset-0 -z-10 rounded-full bg-cart-accent-soft shadow-[inset_0_0_0_1px_var(--color-cart-line-strong)]"
                transition={{ type: "spring", damping: 28, stiffness: 360 }}
              />
            )}
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Export button — functional xlsx download                                 */
/* ──────────────────────────────────────────────────────────────────────── */

async function downloadExcel(slug: string) {
  const res = await fetch(`/api/events/${slug}/export`);
  if (!res.ok) throw new Error("export_failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-reporte.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ExportButton({ slug, disabled }: { slug: string | null; disabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (!slug || loading) return;
    setLoading(true);
    setError(null);
    try {
      await downloadExcel(slug);
    } catch {
      setError("No se pudo exportar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = disabled || loading;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={!!isDisabled}
        aria-disabled={!!isDisabled}
        suppressHydrationWarning
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors active:scale-[0.97] sm:px-4 sm:py-2.5 sm:text-[13.5px] ${
          isDisabled
            ? "cursor-not-allowed border-cart-line bg-cart-bg-elev text-cart-ink-4"
            : "border-cart-accent/40 bg-cart-accent-soft text-white hover:border-cart-accent/70"
        }`}
      >
        {loading ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.25" />
            <path
              d="M14 8a6 6 0 00-6-6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M8 2v8m0 0l3-3m-3 3L5 7M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span className="hidden sm:inline">
          {loading ? "Generando…" : "Exportar a Excel"}
        </span>
        <span className="sm:hidden">{loading ? "…" : "Exportar"}</span>
      </button>
      {error && (
        <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11.5px] font-medium text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* KPI cards with counter animation                                         */
/* ──────────────────────────────────────────────────────────────────────── */

function KpiCard({
  index,
  label,
  value,
  format,
  delta,
  tone,
  subnote,
}: {
  index: number;
  label: string;
  value: number;
  format: (v: number) => string;
  delta: number | null;
  tone?: "accent" | "green";
  /** Nota secundaria opcional (ej. "3 reservadas") — reemplaza el delta cuando este es null. */
  subnote?: string;
}) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => format(v));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.9,
      delay: 0.08 * index,
      ease: [0.22, 1, 0.36, 1],
    });
    return controls.stop;
  }, [mv, value, index]);

  const valueColor =
    tone === "accent" ? "text-cart-accent" : tone === "green" ? "text-emerald-300" : "text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.06 * index, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev p-4 sm:min-h-[124px] sm:p-5"
    >
      {tone === "accent" && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, var(--color-cart-accent-glow), transparent 70%)",
            filter: "blur(18px)",
          }}
        />
      )}
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3 sm:text-[11px]">
        {label}
      </div>
      <div className="mt-1.5">
        <motion.div
          className={`relative font-sans text-[clamp(28px,7vw,32px)] font-bold leading-none tracking-[-0.03em] tabular-nums sm:text-[clamp(24px,2.6vw,30px)] ${valueColor}`}
        >
          {display}
        </motion.div>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-cart-ink-4">
          {delta === null ? (
            subnote ? (
              <span className="text-cart-ink-3">{subnote}</span>
            ) : (
              <span>—</span>
            )
          ) : delta >= 0 ? (
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <Arrow up /> {delta.toFixed(1)}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-300">
              <Arrow /> {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {!(delta === null && subnote) && (
            <span className="text-cart-ink-4">vs. periodo previo</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Arrow({ up }: { up?: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d={up ? "M5 8V2M2.5 4.5L5 2l2.5 2.5" : "M5 2v6M2.5 5.5L5 8l2.5-2.5"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Chart                                                                    */
/* ──────────────────────────────────────────────────────────────────────── */

function generateZeroSeries(range: RangeKey): number[] {
  const n = range === "today" ? 24 : range === "7d" ? 7 : range === "30d" ? 30 : 60;
  return new Array(n).fill(0);
}

/**
 * Rellena la serie diaria del backend en buckets contiguos según el rango.
 * El backend devuelve sólo días con ventas; acá expandimos a un array
 * denso (un punto por día) para que el sparkline pinte líneas continuas
 * sin huecos. Para "today" mostramos sólo el día de hoy.
 */
function buildSeries(
  points: Array<{ day: string; ticketsSold: number }>,
  range: RangeKey,
): number[] {
  const map = new Map<string, number>();
  for (const p of points) {
    // p.day puede llegar como "2026-05-27" o "2026-05-27T00:00:00.000Z".
    const key = p.day.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + p.ticketsSold);
  }
  const days = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 60;
  const out: number[] = [];
  // El eje debe alinear con los buckets de la view, que están en hora de Lima.
  // "Hoy" en Lima (no en UTC) — cerca de medianoche difieren de día.
  const limaToday = limaDayKey(new Date());
  const base = new Date(`${limaToday}T00:00:00Z`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(map.get(key) ?? 0);
  }
  return out;
}

/** Fecha (YYYY-MM-DD) del día en hora de Lima para un instante dado. */
function limaDayKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function Sparkline({ data, range }: { data: number[]; range: RangeKey }) {
  const w = 800;
  const h = 220;
  const padL = 40; // espacio para labels Y
  const padR = 16;
  const padT = 12;
  const padB = 28; // espacio para labels X
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(1, ...data);
  const step = innerW / Math.max(1, data.length - 1);
  const pts = data
    .map((v, i) => [padL + i * step, padT + innerH - (v / max) * innerH] as const)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" L ");
  const path = `M ${pts}`;
  const area = `${path} L ${padL + (data.length - 1) * step},${padT + innerH} L ${padL},${padT + innerH} Z`;

  // Y axis ticks: 0, mid, max. Si max es pequeño usamos enteros.
  const yTicks = [0, Math.round(max / 2), max];

  // X axis labels: 4 hitos (primero, 1/3, 2/3, último). Para "today" mostramos
  // sólo "Hoy"; para los demás, fechas cortas tipo "27 may".
  const xLabels = buildXLabels(data.length, range);

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[200px] w-full sm:h-[220px]"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sl-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b87cff" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#b87cff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sl-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#b87cff" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>

        {/* Grid + labels Y */}
        {yTicks.map((tick) => {
          const y = padT + innerH - (tick / max) * innerH;
          return (
            <g key={tick}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="2 4"
              />
              <text
                x={padL - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.45)"
                style={{ font: "500 11px system-ui, sans-serif" }}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Labels X */}
        {xLabels.map(({ i, label }) => {
          const x = padL + i * step;
          return (
            <text
              key={i}
              x={x}
              y={h - 8}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              fill="rgba(255,255,255,0.45)"
              style={{ font: "500 10.5px system-ui, sans-serif" }}
            >
              {label}
            </text>
          );
        })}

        <motion.path
          d={area}
          fill="url(#sl-area)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke="url(#sl-line)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </div>
  );
}

function buildXLabels(n: number, range: RangeKey): Array<{ i: number; label: string }> {
  if (n <= 1) return [{ i: 0, label: "Hoy" }];
  const indices = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1];
  const base = new Date(`${limaDayKey(new Date())}T00:00:00Z`);
  const fmt = new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "UTC" });
  return indices.map((i) => {
    if (range === "today") return { i, label: i === n - 1 ? "Hoy" : "" };
    if (i === n - 1) return { i, label: "Hoy" };
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - (n - 1 - i));
    return { i, label: fmt.format(d) };
  });
}

function SalesEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-[200px] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-cart-line bg-cart-bg/40 px-6 text-center sm:h-[220px]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 100%, rgba(184,124,255,0.10), transparent 70%)",
        }}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative grid size-14 place-items-center rounded-2xl bg-cart-accent-soft text-cart-accent shadow-[0_0_30px_var(--color-cart-accent-glow)]"
      >
        <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M3 14l4-4 3 3 7-7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13 6h4v4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
      <div className="relative mt-4 font-sans text-[16px] font-semibold tracking-[-0.015em] text-white">
        Sin ventas todavía
      </div>
      <div className="relative mt-1 max-w-[36ch] text-[12.5px] leading-relaxed text-cart-ink-3">
        Cuando empiecen las ventas verás el pulso en vivo, minuto a minuto.
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Ticket-type breakdown                                                    */
/* ──────────────────────────────────────────────────────────────────────── */

type BreakdownRow = {
  name: string;
  price: number;
  sold: number;
  capacity: number;
  /** Cantidad de tipos individuales que componen este grupo (1 = no agrupado). */
  count?: number;
  /** Boxes/mesas ocupados (al menos 1 ticket vendido). Sólo relevante si count>1. */
  unitsOccupied?: number;
  /** Si el grupo tiene precios distintos, mostramos rango en lugar del único. */
  priceMax?: number;
};

/**
 * Agrupa SOLO familias de boxes/mesas numeradas (ej. "Box 1", "Box 2"... → "Box"
 * x14), que es cuando un evento define cada unidad como un ticket_type separado
 * y el listado se infla a 30+ filas redundantes.
 *
 * Why: antes se agrupaba por nombre para CUALQUIER tipo, lo que juntaba un
 * "General" de pago con otro "General" gratis en una sola fila y mostraba el
 * precio mínimo (S/0). Las entradas sueltas (general/vip) NO se agrupan: cada
 * ticket_type es su propia fila con su precio real.
 */
function groupTicketRows(
  rows: { name: string; kind: TicketTypeKind; price: number; sold: number; capacity: number }[],
): BreakdownRow[] {
  const groups = new Map<string, BreakdownRow>();
  rows.forEach((r, i) => {
    // Solo los boxes colapsan por tronco de nombre; el resto queda como fila
    // única (clave irrepetible) para no fusionar tipos distintos.
    const key = r.kind === "box" ? `box:${baseName(r.name)}` : `solo:${i}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        name: r.kind === "box" ? baseName(r.name) : r.name,
        price: r.price,
        priceMax: r.price,
        sold: r.sold,
        capacity: r.capacity,
        count: 1,
        unitsOccupied: r.sold > 0 ? 1 : 0,
      });
    } else {
      existing.sold += r.sold;
      existing.capacity += r.capacity;
      existing.count = (existing.count ?? 1) + 1;
      existing.unitsOccupied = (existing.unitsOccupied ?? 0) + (r.sold > 0 ? 1 : 0);
      existing.price = Math.min(existing.price, r.price);
      existing.priceMax = Math.max(existing.priceMax ?? existing.price, r.price);
    }
  });
  return Array.from(groups.values());
}

/**
 * Devuelve la métrica relevante para mostrar en la tabla:
 *  - Para grupos (boxes/mesas, count > 1): se midió por unidades ocupadas
 *    de N totales. Lo que importa al organizador es "cuántos boxes vendí",
 *    no cuántos asientos ocupó cada grupo — eso ya lo decide el host una
 *    vez pagó el box.
 *  - Para tickets singulares (Preventa, General): la métrica natural es
 *    asientos vendidos sobre aforo.
 */
function displayMetric(r: BreakdownRow): { sold: number; total: number; unitLabel: string | null } {
  if ((r.count ?? 1) > 1) {
    return {
      sold: r.unitsOccupied ?? 0,
      total: r.count ?? 0,
      unitLabel: (r.count ?? 0) === 1 ? "vendido" : "vendidos",
    };
  }
  return { sold: r.sold, total: r.capacity, unitLabel: null };
}

/** "Box 1" → "Box"; "Mesa M1" → "Mesa"; "Box S.VIP 3" → "Box S.VIP"; "Preventa" → "Preventa". */
function baseName(name: string): string {
  // Quita sufijos numéricos finales con o sin letra previa: " 1", " 12", " M1", " A3".
  const trimmed = name.trim().replace(/\s+[A-Za-z]?\d+\s*$/, "").trim();
  return trimmed.length > 0 ? trimmed : name.trim();
}

function formatPriceRange(r: BreakdownRow): string {
  if (r.priceMax !== undefined && r.priceMax > r.price) {
    return `${formatMoney(r.price)}–${formatMoney(r.priceMax)}`;
  }
  return formatMoney(r.price);
}

function TicketBreakdown({ rows }: { rows: BreakdownRow[] }) {
  return (
    <>
      <div className="flex flex-col gap-2.5 sm:hidden">
        {rows.map((r, i) => {
          const m = displayMetric(r);
          const pct = m.total > 0 ? Math.min(100, (m.sold / m.total) * 100) : 0;
          return (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-cart-line bg-cart-bg-elev-2/70 p-3.5"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-[14.5px] font-semibold tracking-[-0.01em] text-white">
                    {r.name}
                    {r.count && r.count > 1 && (
                      <span className="ml-1.5 text-[11.5px] font-medium text-cart-ink-3">
                        × {r.count}
                      </span>
                    )}
                  </span>
                  <span className="text-[11.5px] tabular-nums text-cart-ink-3">
                    {formatPriceRange(r)}
                  </span>
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-cart-ink-3">
                  {m.sold.toLocaleString("es-PE")}
                  <span className="text-cart-ink-4"> / {m.total.toLocaleString("es-PE")}</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, delay: 0.15 + 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, var(--color-cart-accent), #c084fc)",
                      boxShadow: "0 0 8px var(--color-cart-accent-glow)",
                    }}
                  />
                </div>
                <span className="w-9 text-right text-[11.5px] font-semibold tabular-nums text-cart-ink-2">
                  {pct.toFixed(0)}%
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="hidden sm:block">
        <table className="w-full border-separate border-spacing-y-1">
          <thead>
            <tr className="text-[11px] font-medium uppercase tracking-[0.1em] text-cart-ink-4">
              <th className="px-2 pb-2 text-left font-medium">Tipo</th>
              <th className="px-2 pb-2 text-right font-medium">Precio</th>
              <th className="px-2 pb-2 text-right font-medium">Vendidos</th>
              <th className="px-2 pb-2 text-right font-medium">Total</th>
              <th className="px-2 pb-2 text-left font-medium">% Vendido</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const m = displayMetric(r);
              const pct = m.total > 0 ? Math.min(100, (m.sold / m.total) * 100) : 0;
              return (
                <motion.tr
                  key={r.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 * i }}
                >
                  <td className="rounded-l-xl bg-cart-bg-elev-2/70 px-3 py-3 text-[13.5px] font-medium text-white">
                    {r.name}
                    {r.count && r.count > 1 && (
                      <span className="ml-1.5 text-[11.5px] font-normal text-cart-ink-3">
                        × {r.count}
                      </span>
                    )}
                  </td>
                  <td className="bg-cart-bg-elev-2/70 px-3 py-3 text-right text-[13px] tabular-nums text-cart-ink-2">
                    {formatPriceRange(r)}
                  </td>
                  <td className="bg-cart-bg-elev-2/70 px-3 py-3 text-right text-[13px] tabular-nums text-white">
                    {m.sold.toLocaleString("es-PE")}
                  </td>
                  <td className="bg-cart-bg-elev-2/70 px-3 py-3 text-right text-[13px] tabular-nums text-cart-ink-3">
                    {m.total.toLocaleString("es-PE")}
                  </td>
                  <td className="rounded-r-xl bg-cart-bg-elev-2/70 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            duration: 0.9,
                            delay: 0.15 + 0.06 * i,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="h-full rounded-full"
                          style={{
                            background:
                              "linear-gradient(90deg, var(--color-cart-accent), #c084fc)",
                            boxShadow: "0 0 8px var(--color-cart-accent-glow)",
                          }}
                        />
                      </div>
                      <span className="w-10 text-right text-[11.5px] tabular-nums text-cart-ink-3">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TicketTypesEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-cart-line bg-cart-bg/40 px-4 py-6 text-center text-[12.5px] text-cart-ink-3">
      Configura tipos de ticket en el evento para verlos desglosados aquí.
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Promoters table — Feature 1 wired                                        */
/* ──────────────────────────────────────────────────────────────────────── */

type PromoterStatRow = {
  promoterId: string;
  code: string;
  name: string;
  ticketsSold: number;
  ticketsValidated: number;
  revenueCents: number;
  payoutCents: number;
  commissionType: "percentage" | "tiered" | "inkind";
  attendanceRate: number;
  flag: "ok" | "watch" | "suspect";
};

function PromotersTable({
  loading,
  rows,
}: {
  loading: boolean;
  rows: PromoterStatRow[];
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-cart-bg-elev-2/60"
          />
        ))}
      </div>
    );
  }

  const withSales = rows.filter((r) => r.ticketsSold > 0);
  if (withSales.length === 0) {
    return <PromotersEmpty />;
  }

  const ranked = [...withSales].sort((a, b) => b.revenueCents - a.revenueCents);

  return (
    <>
      {/* Mobile: cards */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {ranked.map((r, i) => {
          const avg = r.ticketsSold > 0 ? r.revenueCents / r.ticketsSold : 0;
          return (
            <motion.div
              key={r.promoterId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.04 * i }}
              className="rounded-2xl border border-cart-line bg-cart-bg-elev-2/70 p-3.5"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cart-accent-soft text-[11px] font-bold text-cart-accent">
                      {i + 1}
                    </span>
                    <span className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-white">
                      {r.name || r.code}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.1em] text-cart-ink-4">
                    Origen QR · {r.code}
                  </div>
                </div>
                <FlagBadge flag={r.flag} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Tickets" value={r.ticketsSold.toLocaleString("es-PE")} />
                <Stat label="Recaudado" value={formatMoney(r.revenueCents)} />
                <Stat label="Ticket prom." value={formatMoney(avg)} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block">
        <table className="w-full border-separate border-spacing-y-1">
          <thead>
            <tr className="text-[11px] font-medium uppercase tracking-[0.1em] text-cart-ink-4">
              <th className="px-2 pb-2 text-left font-medium">#</th>
              <th className="px-2 pb-2 text-left font-medium">Promotor · Origen QR</th>
              <th className="px-2 pb-2 text-right font-medium">Tickets</th>
              <th className="px-2 pb-2 text-right font-medium">Recaudado</th>
              <th className="px-2 pb-2 text-right font-medium">A pagar</th>
              <th className="px-2 pb-2 text-right font-medium">Ticket prom.</th>
              <th className="px-2 pb-2 text-right font-medium">Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r, i) => {
              const avg = r.ticketsSold > 0 ? r.revenueCents / r.ticketsSold : 0;
              return (
                <motion.tr
                  key={r.promoterId}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.04 * i }}
                >
                  <td className="rounded-l-xl bg-cart-bg-elev-2/70 px-3 py-3 text-[13px] font-semibold tabular-nums text-cart-accent">
                    {i + 1}
                  </td>
                  <td className="bg-cart-bg-elev-2/70 px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 flex-shrink-0 place-items-center rounded-full bg-cart-accent-soft text-[11px] font-bold uppercase text-cart-accent">
                        {(r.name || r.code).slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium text-white">
                          {r.name || r.code}
                        </div>
                        <div className="text-[11px] uppercase tracking-[0.08em] text-cart-ink-4">
                          {r.code}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="bg-cart-bg-elev-2/70 px-3 py-3 text-right text-[13px] tabular-nums text-white">
                    {r.ticketsSold.toLocaleString("es-PE")}
                  </td>
                  <td className="bg-cart-bg-elev-2/70 px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-white">
                    {formatMoney(r.revenueCents)}
                  </td>
                  <td className="bg-cart-bg-elev-2/70 px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-cart-accent">
                    {r.commissionType === "inkind" ? "En especie" : formatMoney(r.payoutCents)}
                  </td>
                  <td className="bg-cart-bg-elev-2/70 px-3 py-3 text-right text-[13px] tabular-nums text-cart-ink-2">
                    {formatMoney(avg)}
                  </td>
                  <td className="rounded-r-xl bg-cart-bg-elev-2/70 px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-[12.5px] tabular-nums text-cart-ink-3">
                        {(r.attendanceRate * 100).toFixed(0)}%
                      </span>
                      <FlagBadge flag={r.flag} />
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.1em] text-cart-ink-4">{label}</div>
      <div className="mt-0.5 text-[12.5px] font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function FlagBadge({ flag }: { flag: "ok" | "watch" | "suspect" }) {
  const map = {
    ok: { label: "OK", cls: "bg-emerald-500/15 text-emerald-300" },
    watch: { label: "Vigilar", cls: "bg-amber-500/15 text-amber-300" },
    suspect: { label: "Revisar", cls: "bg-rose-500/15 text-rose-300" },
  } as const;
  const it = map[flag];
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-[2px] text-[10px] font-semibold uppercase tracking-[0.08em] ${it.cls}`}
    >
      {it.label}
    </span>
  );
}

function PromotersEmpty() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-cart-line bg-cart-bg/40 p-6 text-center"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="grid size-14 place-items-center rounded-2xl bg-cart-accent-soft text-cart-accent shadow-[0_0_30px_var(--color-cart-accent-glow)]"
      >
        <svg width="26" height="26" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M2 17c.7-2.3 2.7-3.7 5-3.7s4.3 1.4 5 3.7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="14.5" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12.5 12.2c.7-.6 1.6-.9 2.5-.9 1.9 0 3.5 1.2 4 3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
      <div className="text-[15px] font-semibold tracking-[-0.01em] text-white">
        Sin promotores con ventas aún
      </div>
      <p className="max-w-[40ch] text-[12.5px] leading-[1.55] text-cart-ink-3">
        Cuando un promotor venda con su link, aparecerá aquí con cuántas
        personas ingresaron por él.
      </p>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* No-events empty state (org has zero events)                              */
/* ──────────────────────────────────────────────────────────────────────── */

function NoEventsEmpty() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border border-cart-line bg-cart-bg-elev px-6 py-12 text-center sm:py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(184,124,255,0.15), transparent 70%)",
        }}
      />
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative grid size-20 place-items-center rounded-3xl bg-cart-accent-soft text-cart-accent shadow-[0_0_50px_var(--color-cart-accent-glow)]"
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 9h18M7 3v4M17 3v4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M12 13v4M10 15h4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
      <div className="relative max-w-[44ch]">
        <h2 className="font-sans text-[22px] font-bold tracking-[-0.02em] text-white sm:text-[26px]">
          Aún no tienes eventos
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-cart-ink-3">
          Cuando tengas un evento publicado, sus métricas aparecerán aquí —
          recaudación, top promotores y export a Excel.
        </p>
      </div>
      <Link
        href="/es/org/eventos/nuevo"
        className="relative mt-1 inline-flex items-center gap-2 rounded-full bg-cart-accent px-5 py-2.5 text-[13.5px] font-semibold text-cart-on-accent shadow-[0_0_30px_var(--color-cart-accent-glow)] transition-transform active:scale-95"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 3v10M3 8h10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        Crear evento
      </Link>
    </motion.div>
  );
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";

export type BrandFilterItem = {
  id: string;
  label: string;
  /** null = "all" (no filter). Anything else is the orgId. */
  value: string | null;
};

export type FilterableEvent = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  venue: string | null;
  coverUrl: string | null;
  orgId: string;
  orgSlug: string;
  orgName: string;
  minPriceCents: number | null;
};

export function BrandFilterBar({
  items,
  events,
  variant,
}: {
  items: BrandFilterItem[];
  events: FilterableEvent[];
  variant: "mobile" | "desktop";
}) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "all");
  const active = items.find((i) => i.id === activeId) ?? items[0];

  const filtered = useMemo(() => {
    if (!active || active.value == null) return events;
    return events.filter((e) => e.orgId === active.value);
  }, [active, events]);

  return (
    <>
      <div
        role="tablist"
        aria-label="Filtrar por marca"
        className={
          variant === "desktop"
            ? "mt-4 flex flex-wrap gap-2"
            : "mt-4 -mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {items.map((item) => {
          const on = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActiveId(item.id)}
              className={
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition " +
                (on
                  ? "border-cart-accent bg-cart-accent-soft text-cart-accent"
                  : "border-cart-line bg-cart-bg-elev text-cart-ink-2 hover:border-cart-line-strong hover:text-white")
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {variant === "desktop" ? <EventGrid events={filtered} /> : <EventList events={filtered} />}
    </>
  );
}

// ============================================================
// Renderers — co-located with the filter so we keep this client-only
// component self-contained.
// ============================================================
function EventList({ events }: { events: FilterableEvent[] }) {
  if (events.length === 0) return <EmptyState />;
  return (
    <div className="mt-4 flex flex-col gap-3">
      {events.map((ev, i) => (
        <EventRow key={ev.id} ev={ev} featured={i === 0} />
      ))}
    </div>
  );
}

function EventGrid({ events }: { events: FilterableEvent[] }) {
  if (events.length === 0) return <EmptyState />;
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {events.map((ev, i) => (
        <EventCard key={ev.id} ev={ev} featured={i === 0} />
      ))}
    </div>
  );
}

function EventRow({ ev, featured }: { ev: FilterableEvent; featured: boolean }) {
  return (
    <Link
      href={`/events/${ev.slug}` as never}
      className={
        "relative flex items-center gap-3 overflow-hidden rounded-2xl bg-cart-bg-elev p-3 transition hover:bg-cart-bg-elev-2 " +
        (featured
          ? "border border-cart-accent/60 shadow-[0_0_24px_-8px_var(--color-cart-accent-glow)]"
          : "border border-cart-line")
      }
    >
      <EventThumb ev={ev} size={64} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold tracking-[-0.01em]">{ev.title}</div>
        <div className="mt-0.5 text-[12.5px] text-cart-accent">{formatDate(ev.startsAt)}</div>
        <div className="flex items-center gap-1.5 truncate text-[11.5px] text-cart-ink-3">
          <span className="truncate">{ev.orgName}</span>
          {ev.venue && <span>·</span>}
          {ev.venue && <span className="truncate">{ev.venue}</span>}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-[0.14em] text-cart-ink-4">DESDE</div>
        <div className="font-mono text-[13.5px] font-semibold">{formatCents(ev.minPriceCents)}</div>
      </div>
    </Link>
  );
}

function EventCard({ ev, featured }: { ev: FilterableEvent; featured: boolean }) {
  return (
    <Link
      href={`/events/${ev.slug}` as never}
      className={
        "group relative flex flex-col overflow-hidden rounded-3xl bg-cart-bg-elev transition hover:-translate-y-[2px] " +
        (featured
          ? "border border-cart-accent/60 shadow-[0_24px_64px_-24px_var(--color-cart-accent-glow)]"
          : "border border-cart-line hover:border-cart-line-strong")
      }
    >
      <div className="relative aspect-16/10 w-full overflow-hidden">
        <EventThumb ev={ev} size={null} fill />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-white backdrop-blur">
          {ev.orgName.toUpperCase()}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-cart-accent">
          {formatDate(ev.startsAt)}
        </div>
        <div className="text-[18px] font-semibold tracking-[-0.015em]">{ev.title}</div>
        {ev.venue && <div className="truncate text-[12.5px] text-cart-ink-3">{ev.venue}</div>}
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-cart-ink-4">DESDE</div>
            <div className="font-mono text-[16px] font-semibold">{formatCents(ev.minPriceCents)}</div>
          </div>
          <span className="text-[12.5px] font-medium text-cart-ink-2 transition group-hover:text-white">
            Ver entradas →
          </span>
        </div>
      </div>
    </Link>
  );
}

function EventThumb({
  ev,
  size,
  fill,
}: {
  ev: { coverUrl: string | null; title: string };
  size: number | null;
  fill?: boolean;
}) {
  const initial = (ev.title[0] ?? "?").toUpperCase();
  const className = fill
    ? "absolute inset-0 size-full object-cover"
    : "shrink-0 overflow-hidden rounded-xl";
  if (ev.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ev.coverUrl}
        alt=""
        className={className}
        style={size != null ? { width: size, height: size } : undefined}
      />
    );
  }
  if (fill) {
    return (
      <div
        className="absolute inset-0 size-full"
        style={{ background: "linear-gradient(135deg, #B87CFF 0%, #FF4D5E 100%)" }}
      />
    );
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl text-[18px] font-semibold text-white"
      style={{
        width: size ?? 60,
        height: size ?? 60,
        background: "linear-gradient(135deg, #B87CFF, #FF4D5E)",
      }}
    >
      {initial}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-3xl border border-dashed border-cart-line bg-cart-bg-elev/40 px-6 py-12 text-center">
      <div className="text-[40px]">🌒</div>
      <div className="mt-1 text-[15px] font-semibold">Sin eventos en esta marca</div>
      <div className="max-w-[280px] text-[13px] text-cart-ink-3">
        Prueba con &quot;Todos&quot; o vuelve más tarde.
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleString("es-PE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/\./g, "");
  } catch {
    return iso;
  }
}

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  const soles = cents / 100;
  const rounded = Number.isInteger(soles) ? soles.toFixed(0) : soles.toFixed(2);
  return `S/ ${rounded}`;
}

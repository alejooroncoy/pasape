"use client";

import { Suspense, use, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { formatMoney } from "@/lib/_shared/format";
import type { TicketType } from "@/server/events/domain/Event";
import { VenueLayoutModal } from "@/components/ui/VenueLayoutModal";
import {
  eventAvailability,
  groupTicketTypesByZone,
  summarizeZone,
  ticketStatus,
  unitNounPlural,
  type TicketGroup,
  type ZoneSummary,
} from "@/lib/events/ticketDisplay";

type Props = { params: Promise<{ slug: string }> };

export default function EventDetailPage(props: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EventDetailInner {...props} />
    </Suspense>
  );
}

function EventDetailInner({ params }: Props) {
  const { slug } = use(params);
  const { data, isLoading, error } = useEvent(slug);
  const search = useSearchParams();
  const promo = search.get("promo");
  const router = useRouter();

  const groups = useMemo(
    () => (data ? groupTicketTypesByZone(data.ticketTypes) : []),
    [data],
  );

  const availability = useMemo(
    () => (data ? eventAvailability(data.ticketTypes) : { freeBoxes: 0, freeSeats: 0, total: 0 }),
    [data],
  );

  const buyHref = (zone?: string | null) => {
    const params = new URLSearchParams();
    if (promo) params.set("promo", promo);
    if (zone) params.set("zone", zone);
    const qs = params.toString();
    return `/events/${slug}/buy${qs ? `?${qs}` : ""}`;
  };

  if (isLoading) return <PageSkeleton />;
  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cart-bg px-6 text-center text-cart-ink-2">
        <div>
          <p className="text-[15px]">No pudimos cargar este evento.</p>
          <Link
            href={"/" as never}
            className="mt-3 inline-block text-[13px] text-cart-accent underline"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const { event } = data;
  const startsAt = new Date(event.startsAt);
  const allSoldOut = availability.total === 0;

  return (
    <div className="min-h-dvh bg-cart-bg text-white">
      <Hero event={event} startsAt={startsAt} />

      <div className="mx-auto w-full max-w-[1120px] px-5 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10 lg:pt-8">
          <div className="pb-32 lg:pb-12">
            <div className="pt-5 lg:hidden">
              <DatePill startsAt={startsAt} timezone={event.timezone} />
              <h1 className="mt-3 text-[30px] font-bold leading-[1.05] tracking-[-0.02em] sm:text-[34px]">
                {event.title}
              </h1>
              {event.venue && (
                <p className="mt-2 text-[14px] text-cart-ink-3">
                  <LocationIcon /> {event.venue}
                </p>
              )}
            </div>

            <div className="hidden lg:block">
              <h1 className="text-[44px] font-bold leading-[1.02] tracking-[-0.022em]">
                {event.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-cart-ink-2">
                <span className="font-medium">
                  <CalendarIcon /> {formatLongDate(startsAt, event.timezone)}
                </span>
                {event.venue && (
                  <span className="text-cart-ink-3">
                    <LocationIcon /> {event.venue}
                  </span>
                )}
              </div>
            </div>

            {promo && <PromoBanner promo={promo} />}

            {event.description && <DescriptionBlock text={event.description} />}

            <FeatureGrid />

            {event.venueLayoutUrl && (
              <VenueLayoutBanner url={event.venueLayoutUrl} venue={event.venue} />
            )}

            <div className="mt-8 lg:hidden">
              <SectionTitle>Entradas</SectionTitle>
              <ZoneCardList
                groups={groups}
                onPickZone={(zone) => router.push(buyHref(zone) as never)}
              />
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <div className="rounded-3xl border border-cart-line bg-cart-bg-elev p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
                <AvailabilityHeader availability={availability} />

                <div className="mt-4">
                  <ZoneCardList
                    groups={groups}
                    compact
                    onPickZone={(zone) => router.push(buyHref(zone) as never)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => router.push(buyHref() as never)}
                  disabled={allSoldOut}
                  className="mt-5 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
                >
                  {allSoldOut ? "Agotado" : "Comprar entradas"}
                </button>

                <p className="mt-3 text-center text-[11.5px] text-cart-ink-4">
                  Yape, tarjeta o transferencia · QR al instante
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-cart-line bg-cart-bg/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <div className="mx-auto px-5 pt-3">
          <button
            type="button"
            onClick={() => router.push(buyHref() as never)}
            disabled={allSoldOut}
            className="w-full rounded-full bg-cart-accent py-3.5 text-[15px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition active:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
          >
            {allSoldOut ? "Agotado" : "Comprar entradas"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== Availability header ============================== */

function AvailabilityHeader({
  availability,
}: {
  availability: { freeBoxes: number; freeSeats: number; total: number };
}) {
  if (availability.total === 0) {
    return (
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-rose-300">
        Agotado
      </p>
    );
  }
  const parts: string[] = [];
  if (availability.freeBoxes > 0) {
    // "espacios" como copy neutral del header cuando mezclás zonas con nouns
    // distintos. En las cards individuales sí se respeta el noun por zona.
    parts.push(
      `${availability.freeBoxes} ${availability.freeBoxes === 1 ? "espacio libre" : "espacios libres"}`,
    );
  }
  if (availability.freeSeats > 0) {
    parts.push(`${availability.freeSeats} entradas`);
  }
  return (
    <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-400">
      <span className="size-1.5 rounded-full bg-emerald-400" />
      {parts.join(" · ")}
    </p>
  );
}

/* ============================== Zone cards ============================== */

function ZoneCardList({
  groups,
  compact,
  onPickZone,
}: {
  groups: TicketGroup[];
  compact?: boolean;
  onPickZone: (zone: string | null) => void;
}) {
  return (
    <div className={"flex flex-col " + (compact ? "gap-2" : "gap-2.5")}>
      {groups.map((group, idx) => (
        <ZoneCard
          key={group.zone ?? `__ungrouped__-${idx}`}
          group={group}
          summary={summarizeZone(group)}
          compact={compact}
          onClick={() => onPickZone(group.zone)}
        />
      ))}
    </div>
  );
}

function ZoneCard({
  group,
  summary,
  compact,
  onClick,
}: {
  group: TicketGroup;
  summary: ZoneSummary;
  compact?: boolean;
  onClick: () => void;
}) {
  const zoneLabel = group.zone ?? "Entradas generales";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={summary.isAllSoldOut}
      className={
        "group flex w-full items-stretch rounded-2xl border bg-cart-bg-elev text-left transition " +
        (summary.isAllSoldOut
          ? "border-cart-line opacity-55"
          : "border-cart-line hover:border-cart-line-strong hover:bg-cart-bg-elev/80") +
        (compact ? " px-3.5 py-3" : " px-4 py-4")
      }
    >
      <div className="min-w-0 flex-1">
        <span
          className={
            "block font-semibold tracking-[-0.01em] " +
            (compact ? "text-[13.5px]" : "text-[15.5px]")
          }
        >
          {zoneLabel}
        </span>
        <div className={"text-cart-ink-3 " + (compact ? "mt-0.5 text-[11px]" : "mt-1 text-[12.5px]")}>
          <ZoneAvailabilityLine summary={summary} />
        </div>
        {summary.isAllBoxes && !summary.isAllSoldOut && (
          <BoxAvailabilityBar items={group.items} className={compact ? "mt-1.5" : "mt-2"} />
        )}
      </div>
      <div className="ml-3 flex flex-col items-end justify-between">
        <span
          className={
            "font-bold tracking-[-0.01em] " +
            (compact ? "text-[13.5px]" : "text-[15.5px]") +
            " " +
            (summary.isAllSoldOut ? "text-cart-ink-3" : "")
          }
        >
          {summary.minPriceCents !== null
            ? formatMoney(summary.minPriceCents, summary.currency)
            : "—"}
        </span>
        {/* Ver → solo en mobile: en desktop el hover indica clickabilidad. */}
        <span
          className={
            "mt-2 inline-flex items-center gap-1 text-[11px] font-semibold lg:hidden " +
            (summary.isAllSoldOut ? "text-cart-ink-3" : "text-cart-accent")
          }
        >
          {summary.isAllSoldOut ? "Agotado" : (
            <>
              Ver
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </span>
        {summary.isAllSoldOut && (
          <span className="mt-2 hidden text-[11px] font-semibold text-cart-ink-3 lg:inline">
            Agotado
          </span>
        )}
      </div>
    </button>
  );
}

function ZoneAvailabilityLine({ summary }: { summary: ZoneSummary }) {
  if (summary.isAllSoldOut) return <>Agotado</>;
  const parts: string[] = [];
  if (summary.totalBoxes > 0) {
    // Ej: "12 de 14 mesas libres" / "1 de 1 lounge libre".
    const word =
      summary.totalBoxes === 1 ? summary.noun : unitNounPlural(summary.noun);
    parts.push(
      `${summary.freeBoxes} de ${summary.totalBoxes} ${word} ${summary.freeBoxes === 1 ? "libre" : "libres"}`,
    );
  }
  if (summary.freeSeats > 0) {
    parts.push(`${summary.freeSeats} disponibles`);
  }
  return <>{parts.join(" · ")}</>;
}

function BoxAvailabilityBar({
  items,
  className,
}: {
  items: TicketType[];
  className?: string;
}) {
  return (
    <div className={"flex flex-wrap gap-[2px] " + (className ?? "")}>
      {items.map((tt) => {
        const status = ticketStatus(tt);
        const free = status.kind === "available";
        return (
          <span
            key={tt.id}
            title={`${tt.name} · ${free ? "libre" : "reservado"}`}
            className={
              "h-[3px] w-2.5 rounded-[1.5px] " +
              (free ? "bg-emerald-400/90" : "bg-cart-ink-4/30")
            }
          />
        );
      })}
    </div>
  );
}

/* ============================== Hero ============================== */

function Hero({
  event,
  startsAt,
}: {
  event: { title: string; coverUrl: string | null; timezone: string };
  startsAt: Date;
}) {
  return (
    <div className="relative w-full overflow-hidden lg:rounded-b-[36px]">
      <div className="relative aspect-[16/10] w-full sm:aspect-[16/8] lg:aspect-[1120/440]">
        {event.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(140deg, #4B1F9A 0%, #7C3AED 40%, #FF4D5E 90%)",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(60% 50% at 20% 30%, rgba(255,255,255,0.22), transparent 60%), radial-gradient(60% 50% at 80% 80%, rgba(0,0,0,0.55), transparent 60%)",
              }}
            />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-cart-bg" />

        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-5 lg:p-6">
          <BackButton />
          <ShareButton title={event.title} />
        </div>

        <div className="absolute bottom-6 left-6 z-10 hidden lg:block">
          <DatePill startsAt={startsAt} timezone={event.timezone} large />
        </div>
      </div>
    </div>
  );
}

function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Volver"
      className="grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M10 3L5 8l5 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function ShareButton({ title }: { title: string }) {
  const onShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
      } catch {
        /* user cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(window.location.href);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Compartir evento"
      className="grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 10V2m0 0L5 5m3-3l3 3M3 10v3a1 1 0 001 1h8a1 1 0 001-1v-3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/* ============================== Sub-blocks ============================== */

function DatePill({
  startsAt,
  timezone,
  large,
}: {
  startsAt: Date;
  timezone: string;
  large?: boolean;
}) {
  const day = new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    day: "2-digit",
  }).format(startsAt);
  const month = new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    month: "short",
  }).format(startsAt).replace(".", "").toUpperCase();
  const weekday = new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    weekday: "short",
  }).format(startsAt).replace(".", "");
  const time = new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startsAt);

  if (large) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3.5 py-1.5 text-[12px] font-medium text-white backdrop-blur-md">
        <CalendarIcon />
        {weekday} {day} {month} · {time}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-cart-bg-elev px-3 py-1.5 text-[11.5px] font-medium uppercase tracking-[0.06em] text-cart-ink-2">
      <CalendarIcon />
      {day} {month} · {time}
    </span>
  );
}

function PromoBanner({ promo }: { promo: string }) {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-cart-accent/30 bg-cart-accent-soft px-4 py-3">
      <span className="grid size-9 flex-shrink-0 place-items-center rounded-full bg-cart-accent/20 text-cart-accent">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M3 7l3 3 7-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-white">
          Comprando con código de promotor
        </div>
        <div className="truncate text-[11.5px] text-cart-ink-3">
          Tu compra apoya al promotor que te compartió el link · <span className="font-mono text-cart-ink-2">{promo}</span>
        </div>
      </div>
    </div>
  );
}

function DescriptionBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 240;
  const display = !expanded && isLong ? text.slice(0, 240) + "…" : text;
  return (
    <div className="mt-7">
      <SectionTitle>Sobre el evento</SectionTitle>
      <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-[1.6] text-cart-ink-2">
        {display}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[13px] font-medium text-cart-accent hover:underline"
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      )}
    </div>
  );
}

function FeatureGrid() {
  return (
    <div className="mt-7 grid grid-cols-3 gap-2">
      <FeatureChip
        icon={<YapeMini />}
        label="Yape"
        sub="o tarjeta"
      />
      <FeatureChip
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 9h2v2H9zm3 3h2v2h-2z" fill="currentColor" />
          </svg>
        }
        label="QR al instante"
        sub="sin esperas"
      />
      <FeatureChip
        icon={
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1.5l5 2.5v4c0 3.5-2.5 5.5-5 6.5-2.5-1-5-3-5-6.5v-4l5-2.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        }
        label="Seguro"
        sub="entrada válida"
      />
    </div>
  );
}

function FeatureChip({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-2xl border border-cart-line bg-cart-bg-elev/60 px-3.5 py-3">
      <span className="text-cart-accent">{icon}</span>
      <div>
        <div className="text-[12px] font-semibold text-white">{label}</div>
        <div className="text-[10.5px] text-cart-ink-3">{sub}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
      {children}
    </h2>
  );
}

function VenueLayoutBanner({
  url,
  venue,
}: {
  url: string;
  venue: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-7">
      <SectionTitle>Plano del local</SectionTitle>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 group block w-full overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev transition hover:border-cart-line-strong"
      >
        <div className="relative aspect-[16/9] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={venue ? `Plano de ${venue}` : "Plano del local"}
            className="absolute inset-0 size-full object-cover opacity-90 transition group-hover:opacity-100"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 pb-3.5">
            <span className="text-[12.5px] font-semibold text-white">
              Ver plano completo
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition group-hover:bg-white/25">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 7V3h4M13 9v4h-4M3 3l4.5 4.5M13 13l-4.5-4.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
        </div>
      </button>
      <VenueLayoutModal
        open={open}
        onOpenChange={setOpen}
        url={url}
        caption={venue ? `${venue} · Ubicación referencial` : "Ubicación referencial"}
      />
    </div>
  );
}

/* ============================== Skeleton ============================== */

function PageSkeleton() {
  return (
    <div className="min-h-dvh bg-cart-bg">
      <div className="aspect-[16/10] w-full animate-pulse bg-cart-bg-elev sm:aspect-[16/8] lg:aspect-[1120/440] lg:rounded-b-[36px]" />
      <div className="mx-auto max-w-[1120px] px-5 pt-6 lg:px-8 lg:pt-8">
        <div className="h-7 w-2/3 animate-pulse rounded-lg bg-cart-bg-elev" />
        <div className="mt-3 h-4 w-1/3 animate-pulse rounded-lg bg-cart-bg-elev" />
        <div className="mt-8 space-y-2">
          <div className="h-14 animate-pulse rounded-2xl bg-cart-bg-elev" />
          <div className="h-14 animate-pulse rounded-2xl bg-cart-bg-elev" />
        </div>
      </div>
    </div>
  );
}

/* ============================== Icons ============================== */

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="inline-block -mt-0.5 mr-1.5 align-middle">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="inline-block -mt-0.5 mr-1.5 align-middle">
      <path
        d="M8 14s5-4.5 5-8.5A5 5 0 008 .5a5 5 0 00-5 5C3 9.5 8 14 8 14z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function YapeMini() {
  return (
    <svg width="18" height="14" viewBox="0 0 24 18" fill="none">
      <rect x="0.5" y="0.5" width="23" height="17" rx="3" stroke="currentColor" />
      <text x="12" y="12" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor">YAPE</text>
    </svg>
  );
}

/* ============================== Date helper ============================== */

function formatLongDate(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

// Marcamos como referenciado para evitar warning de unused export entre archivos.
export type { TicketType };

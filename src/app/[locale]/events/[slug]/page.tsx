"use client";

import { Suspense, use, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useSaveEvent } from "@/lib/identity/hooks/useSaveEvent";
import { useEventShowcase } from "@/lib/events/hooks/useEventShowcase";
import { useEventPartners } from "@/lib/events/hooks/useEventPartners";
import type { ShowcaseEvent, ShowcaseOrg } from "@/server/events/application/GetEventOrgShowcase";
import type { EventPartner } from "@/server/events/application/EventPartners";
import { formatMoney, formatPrice } from "@/lib/_shared/format";
import { Price } from "@/components/ui/Price";
import { useImagePalette } from "@/lib/_shared/useImagePalette";
import type { TicketType } from "@/server/events/domain/Event";
import { VenueLayoutModal } from "@/components/ui/VenueLayoutModal";
import { PresaleCountdown, shouldCountdown } from "@/components/ui/PresaleCountdown";
import { activePricing } from "@/lib/events/pricing";
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
  const showcase = useEventShowcase(slug);
  const partners = useEventPartners(slug);
  const search = useSearchParams();
  const promo = search.get("promo");
  const router = useRouter();

  const groups = useMemo(
    () => (data ? groupForDetail(data.ticketTypes) : []),
    [data],
  );

  const availability = useMemo(
    () => (data ? eventAvailability(data.ticketTypes) : { freeBoxes: 0, freeSeats: 0, total: 0 }),
    [data],
  );

  const [zoneQty, setZoneQty] = useState<Record<string, number>>({});

  const liveUnits = useMemo(
    () => Object.values(zoneQty).reduce((a, b) => a + b, 0),
    [zoneQty],
  );

  const liveTotalCents = useMemo(
    () =>
      groups.reduce((sum, group) => {
        const qty = zoneQty[detailGroupKey(group)] ?? 0;
        const price = summarizeZone(group).minPriceCents ?? 0;
        return sum + qty * price;
      }, 0),
    [groups, zoneQty],
  );

  const buyHref = (group?: TicketGroup) => {
    const p = new URLSearchParams();
    if (promo) p.set("promo", promo);
    if (group) {
      const single = group.items.length === 1 ? group.items[0] : null;
      // Entrada convencional → pre-selecciona por id; box → por zona.
      if (single && single.kind !== "box") p.set("tt", single.id);
      else if (group.zone) p.set("zone", group.zone);
      const qty = zoneQty[detailGroupKey(group)];
      if (qty) p.set("qty", String(qty));
    }
    const qs = p.toString();
    return `/events/${slug}/buy${qs ? `?${qs}` : ""}`;
  };

  const buyHrefAll = () => {
    const p = new URLSearchParams();
    if (promo) p.set("promo", promo);
    // Desglose por tipo de entrada (id:cantidad) para no perder qué eligió en
    // cada card. Las claves "tt:" son entradas; las "zone:" (boxes) se eligen
    // por separado en la compra, así que solo arrastramos la cantidad total.
    const sel: string[] = [];
    for (const [key, qty] of Object.entries(zoneQty)) {
      if (qty > 0 && key.startsWith("tt:")) sel.push(`${key.slice(3)}:${qty}`);
    }
    if (sel.length) p.set("sel", sel.join(","));
    else if (liveUnits > 0) p.set("qty", String(liveUnits));
    const qs = p.toString();
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
      <div className="mx-auto w-full max-w-[1120px] px-5 lg:px-8">
        <div className="grid gap-8 pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10 lg:pt-8">
          <div className="pb-32 lg:pb-12">
            {/* Flyer contenido (estilo Joinnus): el afiche vertical se ve
                completo — nunca recortado — y un gradiente con los colores
                del propio flyer rellena el marco. */}
            <FlyerCard event={event} eventId={event.id} startsAt={startsAt} />

            <div className="pt-5 lg:hidden">
              <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.02em] sm:text-[34px]">
                {event.title}
              </h1>
              <div className="mt-3 flex flex-col gap-1 text-[14px] text-cart-ink-2">
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

            <div className="hidden lg:block lg:pt-6">
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

            {/* Jerarquía del comprador peruano: 1) flyer, 2) distribución del
                local, 3) entradas. El plano va ANTES que la descripción — el
                usuario decide su zona mirando el plano, recién ahí compra. */}
            {event.venueLayoutUrl && (
              <VenueLayoutBanner url={event.venueLayoutUrl} venue={event.venue} />
            )}

            <div className="mt-8 lg:hidden">
              <SectionTitle>Entradas</SectionTitle>
              <ZoneCardList
                groups={groups}
                zoneQty={zoneQty}
                onZoneQtyChange={(key, qty) =>
                  setZoneQty((prev) => ({ ...prev, [key]: qty }))
                }
                onPickZone={(group) => router.push(buyHref(group) as never)}
              />
            </div>

            {event.description && <DescriptionBlock text={event.description} />}

            {/* Productora del evento — lleva a su vitrina (estilo Passline/Luma). */}
            {showcase.data?.org && <OrganizerChip org={showcase.data.org} />}

            <FeatureGrid />

            {partners.data && partners.data.length > 0 && (
              <PartnersStrip partners={partners.data} />
            )}

            {/* Más eventos de la misma productora — cross-sell. */}
            {showcase.data && showcase.data.events.length > 0 && (
              <MoreFromOrg org={showcase.data.org} events={showcase.data.events} />
            )}
          </div>

          <aside className="hidden lg:block">
            {/* top-20 = altura del PublicHeader sticky (~57px) + respiro */}
            <div className="sticky top-20">
              <div className="rounded-3xl border border-cart-line bg-cart-bg-elev p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
                <AvailabilityHeader availability={availability} />

                <div className="mt-4">
                  <ZoneCardList
                    groups={groups}
                    compact
                    zoneQty={zoneQty}
                    onZoneQtyChange={(key, qty) =>
                      setZoneQty((prev) => ({ ...prev, [key]: qty }))
                    }
                    onPickZone={(group) => router.push(buyHref(group) as never)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => router.push(buyHrefAll() as never)}
                  disabled={allSoldOut}
                  className="mt-5 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
                >
                  {allSoldOut
                    ? "Agotado"
                    : liveUnits > 0
                      ? `${liveUnits} ${liveUnits === 1 ? "entrada" : "entradas"} · ${formatPrice(liveTotalCents, "PEN")}`
                      : "Comprar entradas"}
                </button>

                <p className="mt-3 text-center text-[11.5px] text-cart-ink-4">
                  Yape, tarjeta o transferencia · QR al instante
                </p>
              </div>

              {showcase.data && showcase.data.events.length > 0 && (
                <SidebarMoreFromOrg org={showcase.data.org} events={showcase.data.events} />
              )}
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
            onClick={() => router.push(buyHrefAll() as never)}
            disabled={allSoldOut}
            className="w-full rounded-full bg-cart-accent py-3.5 text-[15px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition active:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
          >
            {allSoldOut
              ? "Agotado"
              : liveUnits > 0
                ? `${liveUnits} ${liveUnits === 1 ? "entrada" : "entradas"} · ${formatMoney(liveTotalCents, "PEN")}`
                : "Comprar entradas"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================== Productora / cross-sell ============================== */

function OrganizerChip({ org }: { org: ShowcaseOrg }) {
  const initial = (org.name || "?")[0].toUpperCase();
  return (
    <Link
      href={`/${org.slug}` as never}
      className="mt-6 flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3 transition hover:border-cart-line-strong"
    >
      <div className="size-10 shrink-0 overflow-hidden rounded-xl bg-cart-bg-elev-2">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={org.name} className="size-full object-cover" />
        ) : (
          <div
            className="grid size-full place-items-center text-[16px] font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${org.brandColor ?? "#7C3AED"}, #1A0A2E)` }}
          >
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Organiza
        </div>
        <div className="truncate text-[14.5px] font-semibold">{org.name}</div>
      </div>
      <span className="text-[12.5px] font-medium text-cart-accent">Ver perfil →</span>
    </Link>
  );
}

function MoreFromOrg({ org, events }: { org: ShowcaseOrg; events: ShowcaseEvent[] }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <SectionTitle>Más de {org.name}</SectionTitle>
        <Link href={`/${org.slug}` as never} className="text-[12.5px] font-medium text-cart-accent">
          Ver todo
        </Link>
      </div>
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {events.map((e) => (
          <Link
            key={e.slug}
            href={`/events/${e.slug}` as never}
            className="w-[180px] shrink-0 snap-start overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev transition hover:border-cart-line-strong"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-cart-bg-elev-2">
              {e.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.coverUrl} alt={e.title} className="size-full object-cover" />
              ) : (
                <div
                  className="size-full"
                  style={{ background: `linear-gradient(135deg, ${org.brandColor ?? "#7C3AED"}, #1A0A2E)` }}
                />
              )}
            </div>
            <div className="p-3">
              <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{e.title}</div>
              <div className="mt-1.5 text-[11.5px] text-cart-ink-3">
                {formatShowcaseDate(e.startsAt)}
              </div>
              {e.minPriceCents != null && (
                <div className="mt-0.5 text-[12.5px] font-semibold">
                  {e.minPriceCents <= 0 ? "Gratis" : `Desde ${formatMoney(e.minPriceCents, "PEN")}`}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function formatShowcaseDate(iso: string): string {
  try {
    return new Date(iso)
      .toLocaleDateString("es-PE", { day: "numeric", month: "short" })
      .replace(".", "");
  } catch {
    return "";
  }
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

// Agrupación para el detalle: las entradas convencionales se muestran UNA POR
// TIPO (titulada por su nombre — "General", "VIP", "General VIP"). Ya no se
// agrupan por zona (concepto removido); el nombre se explica solo. Los boxes sí
// se siguen agrupando en una grilla.
function groupForDetail(items: TicketType[]): TicketGroup[] {
  const out: TicketGroup[] = [];
  const boxes: TicketType[] = [];
  for (const tt of items) {
    if (tt.kind === "box") boxes.push(tt);
    else out.push({ zone: tt.zone, items: [tt] });
  }
  for (const g of groupTicketTypesByZone(boxes)) out.push(g);
  return out;
}

// Key estable de selección por grupo: por id de entrada (cada tipo su card) o,
// para boxes, por zona. Reemplaza la vieja key por zona (colisionaba cuando
// varias entradas no tenían zona).
function detailGroupKey(g: TicketGroup): string {
  const single = g.items.length === 1 ? g.items[0] : null;
  return single && single.kind !== "box" ? `tt:${single.id}` : `zone:${g.zone ?? "__box__"}`;
}

function ZoneCardList({
  groups,
  compact,
  zoneQty,
  onZoneQtyChange,
  onPickZone,
}: {
  groups: TicketGroup[];
  compact?: boolean;
  zoneQty?: Record<string, number>;
  onZoneQtyChange?: (key: string, qty: number) => void;
  onPickZone: (group: TicketGroup) => void;
}) {
  return (
    <div className={"flex flex-col " + (compact ? "gap-2" : "gap-2.5")}>
      {groups.map((group) => {
        const key = detailGroupKey(group);
        const summary = summarizeZone(group);
        const maxQty = summary.freeBoxes + summary.freeSeats;
        return (
          <ZoneCard
            key={key}
            group={group}
            summary={summary}
            compact={compact}
            qty={zoneQty?.[key] ?? 0}
            maxQty={maxQty}
            onQtyChange={onZoneQtyChange ? (q) => onZoneQtyChange(key, q) : undefined}
            onClick={() => onPickZone(group)}
          />
        );
      })}
    </div>
  );
}

function ZoneCard({
  group,
  summary,
  compact,
  qty,
  maxQty,
  onQtyChange,
  onClick,
}: {
  group: TicketGroup;
  summary: ZoneSummary;
  compact?: boolean;
  qty: number;
  maxQty: number;
  onQtyChange?: (qty: number) => void;
  onClick: () => void;
}) {
  // Título de la card: el NOMBRE de la entrada (una card por tipo). Los boxes
  // mantienen su etiqueta de grupo.
  const single = group.items.length === 1 ? group.items[0] : null;
  const zoneLabel =
    single && single.kind !== "box"
      ? single.name
      : group.zone ?? "Entradas generales";
  const presaleItem = group.items.find((i) => activePricing(i).isPresale);
  const ap = presaleItem ? activePricing(presaleItem) : null;

  const handleCounterClick = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    const next = Math.max(0, Math.min(maxQty, qty + delta));
    onQtyChange?.(next);
  };

  return (
    <div
      role="button"
      tabIndex={summary.isAllSoldOut ? -1 : 0}
      onClick={summary.isAllSoldOut ? undefined : onClick}
      onKeyDown={summary.isAllSoldOut ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      aria-disabled={summary.isAllSoldOut}
      className={
        "group flex w-full items-stretch rounded-2xl border bg-cart-bg-elev text-left transition " +
        (summary.isAllSoldOut
          ? "border-cart-line opacity-55 cursor-not-allowed"
          : qty > 0
            ? "border-cart-accent/60 shadow-[0_0_16px_-6px_var(--color-cart-accent-glow)] cursor-pointer"
            : "border-cart-line hover:border-cart-line-strong hover:bg-cart-bg-elev/80 cursor-pointer") +
        (compact ? " px-3.5 py-3" : " px-4 py-4")
      }
    >
      <div className="min-w-0 flex-1">
        <span
          className={
            "flex items-center gap-2 font-semibold tracking-[-0.01em] " +
            (compact ? "text-[13.5px]" : "text-[15.5px]")
          }
        >
          {zoneLabel}
          {ap?.isPresale && (
            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-emerald-300">
              Preventa
            </span>
          )}
        </span>
        <div className={"text-cart-ink-3 " + (compact ? "mt-0.5 text-[11px]" : "mt-1 text-[12.5px]")}>
          <ZoneAvailabilityLine summary={summary} />
        </div>
        {!compact && group.items[0]?.description && (
          <p className="mt-1 text-[11.5px] leading-snug text-cart-ink-3">
            {group.items[0].description}
          </p>
        )}
        {ap?.presaleEndsAt && shouldCountdown(ap.presaleEndsAt) && (
          <div className="mt-1">
            <PresaleCountdown endsAt={ap.presaleEndsAt} />
          </div>
        )}
        {summary.isAllBoxes && !summary.isAllSoldOut && (
          <BoxAvailabilityBar items={group.items} className={compact ? "mt-1.5" : "mt-2"} />
        )}
      </div>
      <div className="ml-3 flex flex-col items-end justify-between">
        <div className="flex flex-col items-end">
          {ap?.isPresale && (
            <span className="text-[11px] font-medium text-cart-ink-4 line-through">
              {formatMoney(ap.basePriceCents, summary.currency)}
            </span>
          )}
          <span
            className={
              "font-bold tracking-[-0.01em] " +
              (compact ? "text-[13.5px]" : "text-[15.5px]") +
              " " +
              (summary.isAllSoldOut ? "text-cart-ink-3" : "")
            }
          >
            {summary.minPriceCents !== null ? (
              <Price cents={summary.minPriceCents} currency={summary.currency} />
            ) : (
              "—"
            )}
          </span>
        </div>
        {/* Contador +/- cuando hay onQtyChange y no está agotado */}
        {!summary.isAllSoldOut && onQtyChange ? (
          <div className="mt-2 flex items-center gap-1.5">
            {qty > 0 ? (
              <>
                <button
                  type="button"
                  onClick={(e) => handleCounterClick(e, -1)}
                  className="grid size-7 place-items-center rounded-full border border-cart-line bg-cart-bg-elev-2 text-white transition hover:border-cart-line-strong"
                  aria-label="Quitar una entrada"
                >
                  <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
                    <path d="M1 1h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <span className={compact ? "w-4 text-center text-[13px] font-bold" : "w-5 text-center text-[14px] font-bold"}>
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleCounterClick(e, +1)}
                  disabled={qty >= maxQty}
                  className="grid size-7 place-items-center rounded-full bg-cart-accent text-cart-bg transition hover:brightness-110 disabled:opacity-40"
                  aria-label="Agregar una entrada"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => handleCounterClick(e, +1)}
                className={
                  "rounded-full border border-cart-accent/50 px-3 py-1 text-cart-accent transition hover:bg-cart-accent/10 " +
                  (compact ? "text-[11px]" : "text-[12px]") +
                  " font-semibold"
                }
                aria-label="Seleccionar esta zona"
              >
                + Elegir
              </button>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
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

function FlyerCard({
  event,
  eventId,
  startsAt,
}: {
  event: { title: string; coverUrl: string | null; timezone: string };
  eventId: string;
  startsAt: Date;
}) {
  const palette = useImagePalette(event.coverUrl);
  // Ratio (ancho/alto) del flyer, medido al cargar la imagen. Permite que el
  // marco "respire" según la proporción (estilo Posh/DICE): un afiche vertical
  // toma un marco alto y uno apaisado un marco banner.
  const [ratio, setRatio] = useState<number | null>(null);

  // Tinte oscuro del propio flyer para el overlay del blur-fill. Mientras
  // carga o si falla CORS → base de marca.
  const tint = palette?.dark ?? "#0D0B14";

  // Alto del marco en desktop según el ratio: retrato → alto, apaisado →
  // banner, cuadrado/intermedio → estándar. Acotado a un rango.
  const frameH = ratio == null ? 360 : ratio < 0.85 ? 410 : ratio > 1.3 ? 270 : 360;

  // Apaisado → el flyer llena el marco a sangre (object-cover): el recorte es
  // mínimo porque su ratio ya es ancho, y evita las barras de blur laterales.
  // Vertical/cuadrado → object-contain + blur-fill (cover recortaría su info).
  const isWide = ratio != null && ratio > 1.3;

  return (
    <div className="relative w-full overflow-hidden rounded-[24px] ring-1 ring-white/10 lg:rounded-[28px]">
      {event.coverUrl ? (
        // Blur-fill: el propio flyer difuminado llena el marco y toma su color
        // (estilo Posh/DICE). Funciona con cualquier proporción sin recortar.
        <div
          className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl saturate-[1.5]"
          style={{ backgroundImage: `url("${event.coverUrl}")` }}
        />
      ) : (
        // Sin flyer → gradiente de marca.
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(140deg, #4B1F9A 0%, #7C3AED 40%, #FF4D5E 90%)",
          }}
        />
      )}
      {/* Viñeta tintada con el color del flyer: asienta el afiche sin apagarlo */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(85% 75% at 50% 35%, ${tint}26 25%, ${tint}b3 100%)`,
        }}
      />

      <div
        className={
          "relative w-full lg:[height:var(--fh)] " +
          (event.coverUrl ? "" : "aspect-[16/10] lg:aspect-auto")
        }
        style={{ ["--fh" as string]: `${frameH}px` }}
      >
        {event.coverUrl && (
          // Mobile: el card toma el ratio natural del flyer (vertical u
          // horizontal, se ve completo). Desktop: marco adaptativo y el
          // blur-fill rellena el letterbox.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt=""
            onLoad={(e) =>
              setRatio(
                e.currentTarget.naturalWidth / e.currentTarget.naturalHeight,
              )
            }
            className={
              // El radius debe ir en el AFICHE, no en el marco. Por eso en desktop
              // la imagen toma el ALTO del marco y su ancho natural (centrada), no
              // size-full: así el <img> = el afiche y rounded-[20px] lo redondea.
              // (Con size-full el afiche "flota" en el blur y queda cuadrado.)
              // Tamaño del marco intacto (frameH original); solo cambia el radius.
              "relative z-[1] mx-auto h-auto max-h-[72vh] w-auto max-w-full rounded-[20px] object-contain " +
              (isWide
                ? "lg:absolute lg:inset-0 lg:size-full lg:max-h-none lg:object-cover"
                : "lg:absolute lg:inset-y-0 lg:left-1/2 lg:h-full lg:w-auto lg:max-h-none lg:-translate-x-1/2")
            }
            style={
              isWide
                ? undefined
                : { filter: "drop-shadow(0 18px 50px rgba(0,0,0,0.55))" }
            }
          />
        )}

        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 sm:p-5">
          <BackButton />
          <div className="flex items-center gap-2">
            <SaveEventButton eventId={eventId} />
            <ShareButton title={event.title} />
          </div>
        </div>

      </div>
    </div>
  );
}

function BackButton() {
  const router = useRouter();
  const hasHistory = typeof window !== "undefined" && window.history.length > 1;
  const handleBack = () => {
    if (hasHistory) {
      router.back();
    } else {
      router.push("/");
    }
  };
  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={hasHistory ? "Volver" : "Inicio"}
      className="grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65"
    >
      {hasHistory ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 6.5L8 2l6 4.5V14a.5.5 0 01-.5.5h-4V10h-3v4.5h-4A.5.5 0 012 14V6.5z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function SaveEventButton({ eventId }: { eventId: string }) {
  const { isSaved, toggle, isPending } = useSaveEvent(eventId);
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={isSaved ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={isSaved}
      className="grid size-10 place-items-center rounded-full bg-black/45 backdrop-blur-md transition hover:bg-black/65 active:scale-90 disabled:opacity-60"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 18 18"
        fill={isSaved ? "var(--color-cart-accent)" : "none"}
        className={isSaved ? "text-cart-accent" : "text-white"}
        aria-hidden
      >
        <path
          d="M9 15.5s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div className="relative">
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
      {copied && (
        <div className="absolute top-12 right-0 animate-in fade-in slide-in-from-top-2 duration-200 whitespace-nowrap rounded-lg bg-white/95 px-3 py-1.5 text-[12px] font-medium text-gray-900 shadow-lg backdrop-blur-sm">
          Copiado en portapapeles
        </div>
      )}
    </div>
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
          {/* object-contain: el plano se ve completo — recortar un plano de
              zonas puede ocultar justo la zona que el cliente quiere. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={venue ? `Plano de ${venue}` : "Plano del local"}
            className="absolute inset-0 size-full object-contain opacity-90 transition group-hover:opacity-100"
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

/* ============================== Partners strip ============================== */

function PartnersStrip({ partners }: { partners: EventPartner[] }) {
  return (
    <div className="mt-7">
      <SectionTitle>Con el apoyo de</SectionTitle>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {partners.map((p) => (
          p.websiteUrl ? (
            <a
              key={p.id}
              href={p.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={p.name}
              className="group flex h-10 items-center overflow-hidden rounded-xl border border-cart-line bg-cart-bg-elev px-3 transition hover:border-cart-line-strong"
            >
              {p.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logoUrl}
                  alt={p.name}
                  className="h-6 max-w-[80px] object-contain grayscale transition group-hover:grayscale-0"
                />
              ) : (
                <span className="text-[12px] font-semibold text-cart-ink-3 transition group-hover:text-white">
                  {p.name}
                </span>
              )}
            </a>
          ) : (
            <div
              key={p.id}
              title={p.name}
              className="flex h-10 items-center overflow-hidden rounded-xl border border-cart-line bg-cart-bg-elev px-3"
            >
              {p.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logoUrl}
                  alt={p.name}
                  className="h-6 max-w-[80px] object-contain grayscale"
                />
              ) : (
                <span className="text-[12px] font-semibold text-cart-ink-3">{p.name}</span>
              )}
            </div>
          )
        ))}
      </div>
    </div>
  );
}

/* ============================== Sidebar extras (desktop) ============================== */

function SidebarVenueThumbnail({ url, venue }: { url: string; venue: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev transition hover:border-cart-line-strong"
      >
        <div className="relative aspect-[16/7] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={venue ? `Plano de ${venue}` : "Plano del local"}
            className="absolute inset-0 size-full object-cover opacity-80 transition group-hover:opacity-100"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 pb-2.5">
            <span className="text-[11.5px] font-semibold text-white">Ver plano del local</span>
            <span className="grid size-7 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 7V3h4M13 9v4h-4M3 3l4.5 4.5M13 13l-4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
          </div>
        </div>
      </button>
      <VenueLayoutModal
        open={open}
        onOpenChange={setOpen}
        url={url}
        caption={venue ? `${venue} · Referencial` : "Referencial"}
      />
    </div>
  );
}

function SidebarMoreFromOrg({ org, events }: { org: ShowcaseOrg; events: ShowcaseEvent[] }) {
  const shown = events.slice(0, 3);
  return (
    <div className="mt-4">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Más de {org.name}
        </span>
        <Link href={`/${org.slug}` as never} className="text-[11.5px] font-medium text-cart-accent">
          Ver todo
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {shown.map((e) => (
          <Link
            key={e.slug}
            href={`/events/${e.slug}` as never}
            className="flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-3 py-2.5 transition hover:border-cart-line-strong"
          >
            <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-cart-bg-elev-2"
              style={!e.coverUrl ? { background: `linear-gradient(135deg, ${org.brandColor ?? "#7C3AED"}, #1A0A2E)` } : undefined}
            >
              {e.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.coverUrl} alt={e.title} className="size-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-[13px] font-semibold">{e.title}</div>
              <div className="mt-0.5 text-[11px] text-cart-ink-3">{formatShowcaseDate(e.startsAt)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ============================== Skeleton ============================== */

function PageSkeleton() {
  return (
    <div className="min-h-dvh bg-cart-bg text-white">
      <div className="mx-auto w-full max-w-[1120px] px-5 lg:px-8">
        <div className="grid gap-8 pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10 lg:pt-8">
          {/* Columna izquierda: flyer + título + entradas (móvil) */}
          <div className="pb-12">
            {/* Flyer redondeado (igual que FlyerCard) */}
            <div className="aspect-[4/5] w-full animate-pulse rounded-[24px] bg-cart-bg-elev ring-1 ring-white/10 sm:aspect-[16/11] lg:aspect-[16/12] lg:rounded-[28px]" />

            {/* Título + meta (solo móvil, como en el layout real) */}
            <div className="pt-5 lg:hidden">
              <div className="h-8 w-3/4 animate-pulse rounded-lg bg-cart-bg-elev" />
              <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-cart-bg-elev" />
              <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-cart-bg-elev" />
            </div>

            {/* Entradas (solo móvil) */}
            <div className="mt-8 lg:hidden">
              <div className="h-5 w-28 animate-pulse rounded bg-cart-bg-elev" />
              <div className="mt-4 flex flex-col gap-2.5">
                <div className="h-[76px] animate-pulse rounded-2xl bg-cart-bg-elev" />
                <div className="h-[76px] animate-pulse rounded-2xl bg-cart-bg-elev" />
              </div>
            </div>
          </div>

          {/* Sidebar (desktop): card de compra */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 rounded-3xl border border-cart-line bg-cart-bg-elev p-5">
              <div className="h-4 w-1/2 animate-pulse rounded bg-cart-bg-elev-2" />
              <div className="mt-4 flex flex-col gap-2.5">
                <div className="h-[76px] animate-pulse rounded-2xl bg-cart-bg-elev-2" />
                <div className="h-[76px] animate-pulse rounded-2xl bg-cart-bg-elev-2" />
              </div>
              <div className="mt-5 h-12 animate-pulse rounded-full bg-cart-bg-elev-2" />
            </div>
          </aside>
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
  const s = new Intl.DateTimeFormat("es-PE", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Marcamos como referenciado para evitar warning de unused export entre archivos.
export type { TicketType };

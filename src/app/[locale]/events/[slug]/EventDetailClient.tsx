"use client";

import { ButtonHTMLAttributes, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { UserHeader } from "@/app/[locale]/_home/UserHeader";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useSaveEvent } from "@/lib/identity/hooks/useSaveEvent";
import { usePromoterDisplayName } from "@/lib/promoters/hooks/usePromoter";
import { useEventShowcase } from "@/lib/events/hooks/useEventShowcase";
import { useEventPartners } from "@/lib/events/hooks/useEventPartners";
import type { ShowcaseEvent, ShowcaseOrg } from "@/server/events/application/GetEventOrgShowcase";
import type { EventPartner } from "@/server/events/application/EventPartners";
import { formatMoney, formatPrice } from "@/lib/_shared/format";
import { Price } from "@/components/ui/Price";
import {
  type Palette,
  readableTextColor,
  ensureContrast,
  themedMutedText,
  mixColors,
  pageTintGradient,
} from "@/lib/_shared/color";
import type { TicketType } from "@/server/events/domain/Event";
import { VenueLayoutModal } from "@/components/ui/VenueLayoutModal";
import { PresaleCountdown, shouldCountdown } from "@/components/ui/PresaleCountdown";
import { activePricing } from "@/lib/events/pricing";
import {
  eventAvailability,
  groupBoxesByNoun,
  summarizeGroup,
  ticketStatus,
  unitNounPlural,
  type TicketGroup,
  type GroupSummary,
} from "@/lib/events/ticketDisplay";

// Server prefetchea `["events", "detail", slug]` (ver page.tsx) → esta query
// hidrata con la data ya resuelta y `isLoading` arranca en false, sin el
// flash negro→color mientras esperaba el fetch del cliente.
export function EventDetailClient({ slug }: { slug: string }) {
  const { data, isLoading, error } = useEvent(slug);
  // Los 3 tonos los eligió el organizador al crear/editar el evento (o los
  // dejó extraídos del flyer) — viajan ya resueltos en `event.palette*`, sin
  // canvas ni decodificación de imagen en el cliente. Si NO personalizó nada
  // (los 3 vienen null), no hay nada que "tematizar": la página se ve como
  // el Pasape normal (negro, morado solo en acentos), no un wash completo.
  const palette = useMemo(() => {
    const ev = data?.event;
    if (!ev?.paletteDark || !ev.paletteMid || !ev.paletteAccent) return null;
    return { dark: ev.paletteDark, mid: ev.paletteMid, accent: ev.paletteAccent };
  }, [data]);
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

  const [groupQty, setGroupQty] = useState<Record<string, number>>({});

  const liveUnits = useMemo(
    () => Object.values(groupQty).reduce((a, b) => a + b, 0),
    [groupQty],
  );

  const liveTotalCents = useMemo(
    () =>
      groups.reduce((sum, group) => {
        const qty = groupQty[detailGroupKey(group)] ?? 0;
        const price = summarizeGroup(group).minPriceCents ?? 0;
        return sum + qty * price;
      }, 0),
    [groups, groupQty],
  );

  const buyHref = (group?: TicketGroup) => {
    const p = new URLSearchParams();
    if (promo) p.set("promo", promo);
    if (group) {
      const single = group.items.length === 1 ? group.items[0] : null;
      // Entrada convencional → pre-selecciona por id; box → por zona.
      if (single && single.kind !== "box") p.set("tt", single.id);
      const qty = groupQty[detailGroupKey(group)];
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
    for (const [key, qty] of Object.entries(groupQty)) {
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
      <div className="min-h-dvh bg-cart-bg text-cart-ink-2">
        <UserHeader />
        <div className="grid min-h-[60dvh] place-items-center px-6 text-center">
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
      </div>
    );
  }

  const { event } = data;
  const startsAt = new Date(event.startsAt);
  const isClosed = event.status === "closed";
  const allSoldOut = availability.total === 0;

  return (
    <PageContainer palette={palette}>
      <UserHeader tint={palette?.dark} />
      <div className="mx-auto w-full max-w-[1120px] px-5 lg:px-8">
        <div className="grid gap-8 pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10 lg:pt-8">
          <div className="pb-32 lg:pb-12">
            {/* Flyer contenido (estilo Joinnus): el afiche vertical se ve
                completo — nunca recortado — y un gradiente con los colores
                del propio flyer rellena el marco. */}
            <FlyerCard event={event} eventId={event.id} palette={palette} />

            <div className="pt-5 lg:hidden">
              <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.02em] sm:text-[34px]">
                {event.title}
              </h1>
              {isClosed && <EndedBadge />}
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
              {isClosed && <EndedBadge />}
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

            {!isClosed && (
              <div className="mt-8 lg:hidden">
                <SectionTitle>Entradas</SectionTitle>
                <GroupCardList
                  groups={groups}
                  groupQty={groupQty}
                  onGroupQtyChange={(key, qty) =>
                    setGroupQty((prev) => ({ ...prev, [key]: qty }))
                  }
                  onPickGroup={(group) => router.push(buyHref(group) as never)}
                  palette={palette}
                />
              </div>
            )}

            {event.description && <DescriptionBlock text={event.description} />}

            {/* Productora del evento — lleva a su vitrina (estilo Passline/Luma). */}
            {showcase.data?.org && <OrganizerChip org={showcase.data.org} palette={palette} />}

            <FeatureGrid palette={palette} />

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
              <AsideContainer palette={palette}>
                {isClosed ? (
                  <EndedPanel org={showcase.data?.org} />
                ) : (
                  <>
                    <AvailabilityHeader availability={availability} palette={palette} />

                    <div className="mt-4">
                      <GroupCardList
                        groups={groups}
                        compact
                        groupQty={groupQty}
                        onGroupQtyChange={(key, qty) =>
                          setGroupQty((prev) => ({ ...prev, [key]: qty }))
                        }
                        onPickGroup={(group) => router.push(buyHref(group) as never)}
                        palette={palette}
                      />
                    </div>

                    <BuyButton
                      onClick={() => router.push(buyHrefAll() as never)}
                      palette={palette}
                      disabled={allSoldOut}
                    >
                      {allSoldOut
                        ? "Agotado"
                        : liveUnits > 0
                          ? `${liveUnits} ${liveUnits === 1 ? "entrada" : "entradas"} · ${formatPrice(liveTotalCents, "PEN")}`
                          : "Comprar entradas"}
                    </BuyButton>

                    <p className="mt-3 text-center text-[11.5px] text-cart-ink-4">
                      Yape, tarjeta o transferencia · QR al instante
                    </p>
                  </>
                )}
              </AsideContainer>

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
          <BuyButton
            onClick={() => router.push(buyHrefAll() as never)}
            palette={palette}
            disabled={isClosed || allSoldOut}
          >
            {isClosed
              ? "Evento terminado"
              : allSoldOut
                ? "Agotado"
                : liveUnits > 0
                  ? `${liveUnits} ${liveUnits === 1 ? "entrada" : "entradas"} · ${formatMoney(liveTotalCents, "PEN")}`
                  : "Comprar entradas"}
          </BuyButton>
        </div>
      </div>
    </PageContainer>
  );
}

/** Containers que reciben la paleta ya calculada (una sola vez) desde EventDetailInner. */
function PageContainer({ palette, children }: { palette: Palette | null } & React.PropsWithChildren) {
  const tint = palette?.dark ?? "#0D0B14";

  // cart-ink-3/4 son gris frío fijo — pensados para el fondo neutro cart-bg,
  // no para un tinte cálido dinámico. Tailwind v4 genera `text-cart-ink-3`
  // como `color: var(--color-cart-ink-3)`, así que sobreescribir la variable
  // acá arriba corrige el contraste/armonía en TODO el árbol de una vez, sin
  // tocar cada uso suelto (disponibilidad, hints, meta del evento, etc).
  const themedVars = palette
    ? ({
        "--color-cart-ink-3": themedMutedText("#8e8ea1", tint, tint, 4.5),
        "--color-cart-ink-4": themedMutedText("#5e5e70", tint, tint, 3),
      } as React.CSSProperties)
    : undefined;

  return (
    <div
      className="min-h-dvh bg-cart-bg text-white"
      style={{
        // `background-attachment: fixed` para que el % del gradiente se
        // resuelva contra el viewport, igual que en AppHeader (mismo
        // `pageTintGradient`) — así los dos pintan el mismo recorte de
        // fondo en la misma posición de pantalla, sin costura, a cualquier
        // scroll (no son dos colores parecidos, es el mismo fondo).
        backgroundImage: pageTintGradient(tint),
        backgroundAttachment: "fixed",
        ...themedVars,
      }}
    >
      {children}
    </div>
  );
}

function AsideContainer({ palette, children }: { palette: Palette | null } & React.PropsWithChildren) {
  return (
    <div
      className="rounded-3xl border border-cart-line bg-cart-bg-elev p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
      style={{
        background: palette?.dark,
      }}
    >
      {children}
    </div>
  );
}

function BuyButton({
  children,
  palette,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & React.PropsWithChildren & { palette: Palette | null }) {
  // El tinte de marca solo aplica si el botón está activo — si no, las clases
  // `disabled:` (gris, sin sombra) quedarían tapadas por el color inline.
  const tinted = !disabled && palette?.accent;
  // El acento extraído puede salir claro u oscuro según el flyer — el texto
  // se elige por contraste real, no se asume blanco (bug del PR original:
  // un acento claro con texto blanco fijo queda casi ilegible).
  const textColor = tinted ? readableTextColor(palette.accent) : undefined;

  return (
    <button
      type="button"
      disabled={disabled}
      className="mt-5 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
      style={
        tinted
          ? { background: palette.accent, boxShadow: `0 8px 24px -6px ${palette.accent}80`, color: textColor }
          : undefined
      }
      {...props}
    >
      {children}
    </button>
  );
}

function EndedBadge() {
  return (
    <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-cart-line bg-cart-bg-elev px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-cart-ink-3">
      <span className="size-1.5 rounded-full bg-cart-ink-4" />
      Evento terminado
    </span>
  );
}

/** Panel lateral cuando el evento ya terminó: cierre cálido + CTA a la vitrina. */
function EndedPanel({ org }: { org?: ShowcaseOrg }) {
  return (
    <div className="flex flex-col items-center py-3 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-cart-bg-elev-2 ring-1 ring-cart-line">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-cart-ink-2">
          <path
            d="M5 12.5l4.5 4.5L19 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="mt-4 text-[17px] font-bold tracking-[-0.01em] text-white">
        Este evento ya terminó
      </h2>
      <p className="mt-1.5 text-[13px] leading-snug text-cart-ink-3">
        Las ventas están cerradas. ¡Gracias a todos los que asistieron!
      </p>
      {org && (
        <Link
          href={`/${org.slug}` as never}
          className="mt-5 w-full rounded-full border border-cart-line bg-cart-bg-elev-2 py-3 text-[13.5px] font-semibold text-white transition hover:border-cart-line-strong"
        >
          Ver más de {org.name}
        </Link>
      )}
    </div>
  );
}

/* ============================== Productora / cross-sell ============================== */

function OrganizerChip({ org, palette }: { org: ShowcaseOrg; palette: Palette | null }) {
  const initial = (org.name || "?")[0].toUpperCase();
  const bgStart = palette?.mid ?? palette?.dark ?? org.brandColor ?? "#7C3AED";
  const bgEnd = palette?.dark ?? "#1A0A2E";
  const borderColor = palette ? palette.dark ?? "rgba(255,255,255,10)" : "rgba(255,255,255,0.12)";

  const hasPalette = Boolean(palette && (palette.mid || palette.accent || palette.dark));
  const linkStyle: React.CSSProperties | undefined = hasPalette
    ? {
        background: palette?.dark ? `linear-gradient(135deg, ${bgStart}10, ${bgEnd}70)` : undefined,
        border: `1px solid ${borderColor ?? "rgba(255,255,255,0.12)"}`,
      }
    : undefined;
  // "Ver perfil" adopta el acento del flyer (combina con el resto de la
  // página) solo si contrasta contra el fondo del chip — si no, blanco.
  const chipLinkColor = palette?.accent
    ? ensureContrast(palette.accent, bgEnd, "#ffffff", 3)
    : undefined;

  return (
    <Link
      href={`/${org.slug}` as never}
      className="mt-6 flex items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3 transition hover:border-cart-line-strong"
      style={linkStyle}
    >
      <div className="size-10 shrink-0 overflow-hidden rounded-xl bg-cart-bg-elev-2">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={org.name} className="size-full object-cover" />
        ) : (
          <div
            className="grid size-full place-items-center text-[16px] font-bold"
            style={{
              background: `linear-gradient(135deg, ${bgStart}, ${bgEnd})`,
              color: readableTextColor(bgStart),
            }}
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
      <span
        className={chipLinkColor ? "text-[12.5px] font-medium" : "text-[12.5px] font-medium text-cart-accent"}
        style={chipLinkColor ? { color: chipLinkColor } : undefined}
      >
        Ver perfil →
      </span>
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
  palette,
}: {
  availability: { freeBoxes: number; freeSeats: number; total: number };
  palette: Palette | null;
}) {
  // Verde/rojo fijos (emerald-400, rose-300) se pierden contra paletas de la
  // misma familia de color (ej. un flyer verde) — se aclaran solo lo
  // necesario para seguir contrastando contra el fondo del panel, sin
  // saltar a otro tono (mismo criterio que `cardAccent` en GroupCard).
  const bg = palette?.dark ?? "#0D0B14";
  // 4.5:1 = mínimo WCAG AA para texto normal (este es 12px) — 3:1 alcanzaba
  // el umbral de "texto grande" pero se veía apagado en paletas cercanas en
  // tono (ej. verde sobre verde).
  const availableColor = palette ? ensureContrast("#34d399", bg, "#34d399", 4.5) : "#34d399";
  const soldOutColor = palette ? ensureContrast("#fda4af", bg, "#fda4af", 4.5) : "#fda4af";

  if (availability.total === 0) {
    return (
      <p
        className="text-[12px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: soldOutColor }}
      >
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
    <p
      className="flex items-center gap-1.5 text-[12.5px] font-medium"
      style={{ color: availableColor }}
    >
      <span className="size-1.5 rounded-full" style={{ background: availableColor }} />
      {parts.join(" · ")}
    </p>
  );
}

/* ============================== Group cards ============================== */

// Agrupación para el detalle: las entradas convencionales se muestran UNA POR
// TIPO (titulada por su nombre — "General", "VIP"); su nombre ya las diferencia.
// Los boxes ("espacios") se agrupan en una grilla por su unit_noun.
function groupForDetail(items: TicketType[]): TicketGroup[] {
  const out: TicketGroup[] = [];
  const boxes: TicketType[] = [];
  for (const tt of items) {
    if (tt.kind === "box") boxes.push(tt);
    else out.push({ label: null, items: [tt] });
  }
  for (const g of groupBoxesByNoun(boxes)) out.push(g);
  return out;
}

// Key estable de selección por grupo: por id de entrada (cada tipo su card) o,
// para boxes, por su etiqueta de agrupación (unit_noun en plural).
function detailGroupKey(g: TicketGroup): string {
  const single = g.items.length === 1 ? g.items[0] : null;
  return single && single.kind !== "box" ? `tt:${single.id}` : `box:${g.label ?? "__box__"}`;
}

function GroupCardList({
  groups,
  compact,
  groupQty,
  onGroupQtyChange,
  onPickGroup,
  palette,
}: {
  groups: TicketGroup[];
  compact?: boolean;
  groupQty?: Record<string, number>;
  onGroupQtyChange?: (key: string, qty: number) => void;
  onPickGroup: (group: TicketGroup) => void;
  palette: Palette | null;
}) {
  return (
    <div className={"flex flex-col " + (compact ? "gap-2" : "gap-2.5")}>
      {groups.map((group) => {
        const key = detailGroupKey(group);
        const summary = summarizeGroup(group);
        const maxQty = summary.freeBoxes + summary.freeSeats;
        return (
          <GroupCard
            key={key}
            group={group}
            summary={summary}
            compact={compact}
            qty={groupQty?.[key] ?? 0}
            maxQty={maxQty}
            onQtyChange={onGroupQtyChange ? (q) => onGroupQtyChange(key, q) : undefined}
            onClick={() => onPickGroup(group)}
            palette={palette}
          />
        );
      })}
    </div>
  );
}

function GroupCard({
  group,
  summary,
  compact,
  qty,
  maxQty,
  onQtyChange,
  onClick,
  palette,
}: {
  group: TicketGroup;
  summary: GroupSummary;
  compact?: boolean;
  qty: number;
  maxQty: number;
  onQtyChange?: (qty: number) => void;
  onClick: () => void;
  palette: Palette | null;
}) {
  // Título de la card: el NOMBRE de la entrada (una card por tipo). Los boxes
  // usan su etiqueta de grupo (unit_noun en plural: "Boxes", "Mesas").
  const single = group.items.length === 1 ? group.items[0] : null;
  const groupTitle =
    single && single.kind !== "box" ? single.name : group.label ?? "Entradas";
  const freeItem = group.items.find((i) => activePricing(i).isFree);
  const presaleItem = group.items.find((i) => activePricing(i).isPresale);
  const ap = freeItem
    ? activePricing(freeItem)
    : presaleItem
      ? activePricing(presaleItem)
      : null;

  const handleCounterClick = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    const next = Math.max(0, Math.min(maxQty, qty + delta));
    onQtyChange?.(next);
  };

  // Acento de la card: el del flyer si contrasta contra su propio fondo
  // (radial-gradient con palette.dark) — si no, el morado de marca de
  // siempre. Reemplaza el cart-accent fijo del botón "+ Elegir"/stepper/
  // borde seleccionado, que quedaba peleado con paletas cálidas.
  // 4.5:1 (antes 2.5, insuficiente): el acento se usa como TEXTO del botón
  // "+ Elegir" sobre el propio fondo de la card, no solo como borde — con
  // paletas tostadas/cálidas (naranja sobre marrón) un acento de bajo
  // contraste se leía casi invisible.
  const cardBg = palette?.dark ?? "#0D0B14";
  const cardAccent = palette?.accent ? ensureContrast(palette.accent, cardBg, "#B87CFF", 4.5) : "#B87CFF";
  const stepperTextColor = readableTextColor(cardAccent);
  // Mismo criterio que `cardAccent`: el verde fijo de "Gratis"/"Preventa" se
  // aclara si la paleta del flyer es de la misma familia (ej. verde) en vez
  // de perderse contra el fondo de la card.
  const badgeColor = palette ? ensureContrast("#6ee7b7", cardBg, "#6ee7b7", 4.5) : "#6ee7b7";

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
            ? "shadow-[0_0_16px_-6px_var(--color-cart-accent-glow)] cursor-pointer"
            : "border-cart-line hover:border-cart-line-strong hover:bg-cart-bg-elev/80 cursor-pointer") +
        (compact ? " px-3.5 py-3" : " px-4 py-4")
      }
      style={{
        background: `radial-gradient(25% 25% at 20% 25%, ${cardBg}75 15%, ${cardBg}b3 100%)`,
        borderColor: !summary.isAllSoldOut && qty > 0 ? `${cardAccent}99` : undefined,
      }}
    >
      <div className="min-w-0 flex-1">
        <span
          className={
            "flex items-center gap-2 font-semibold tracking-[-0.01em] " +
            (compact ? "text-[13.5px]" : "text-[15.5px]")
          }
        >
          {groupTitle}
          {ap?.isFree ? (
            <span
              className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]"
              style={{ color: badgeColor }}
            >
              Gratis
            </span>
          ) : ap?.isPresale && (
            <span
              className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]"
              style={{ color: badgeColor }}
            >
              Preventa
            </span>
          )}
        </span>
        <div className={"text-cart-ink-3 " + (compact ? "mt-0.5 text-[11px]" : "mt-1 text-[12.5px]")}>
          <GroupAvailabilityLine summary={summary} />
        </div>
        {!compact && group.items[0]?.description && (
          <p className="mt-1 text-[11.5px] leading-snug text-cart-ink-3">
            {group.items[0].description}
          </p>
        )}
        {ap?.freeUntilAt && shouldCountdown(ap.freeUntilAt) ? (
          <div className="mt-1">
            <PresaleCountdown endsAt={ap.freeUntilAt} />
          </div>
        ) : ap?.presaleEndsAt && shouldCountdown(ap.presaleEndsAt) ? (
          <div className="mt-1">
            <PresaleCountdown endsAt={ap.presaleEndsAt} />
          </div>
        ) : null}
        {summary.isAllBoxes && !summary.isAllSoldOut && (
          <BoxAvailabilityBar items={group.items} className={compact ? "mt-1.5" : "mt-2"} />
        )}
      </div>
      <div className="ml-3 flex flex-col items-end justify-between">
        <div className="flex flex-col items-end">
          {(ap?.isPresale || ap?.isFree) && ap.basePriceCents > 0 && (
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
                  className="grid size-7 place-items-center rounded-full transition hover:brightness-110 disabled:opacity-40"
                  style={{ background: cardAccent, color: stepperTextColor }}
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
                  "rounded-full border px-3 py-1 transition hover:brightness-125 " +
                  (compact ? "text-[11px]" : "text-[12px]") +
                  " font-semibold"
                }
                style={{ borderColor: `${cardAccent}cc`, background: `${cardAccent}1f`, color: cardAccent }}
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
                (summary.isAllSoldOut ? "text-cart-ink-3" : "")
              }
              style={summary.isAllSoldOut ? undefined : { color: cardAccent }}
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

function GroupAvailabilityLine({ summary }: { summary: GroupSummary }) {
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
  palette,
}: {
  event: { title: string; coverUrl: string | null; timezone: string };
  eventId: string;
  palette: Palette | null;
}) {
  // Tinte oscuro del propio flyer para el overlay del blur-fill. Mientras
  // carga o si falla CORS → base de marca.
  const tint = palette?.dark ?? "#0D0B14";

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

      <div className={"relative w-full " + (event.coverUrl ? "" : "aspect-[16/10]")}>
        {event.coverUrl && (
          // La imagen SIEMPRE se ve completa (object-contain), limitada por el
          // ancho del panel y por una altura máxima. El panel se ajusta a ella y
          // el blur-fill rellena cualquier hueco (afiches verticales). Nunca se
          // recorta, ni en móvil ni en desktop.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverUrl}
            alt={event.title}
            className="relative z-[1] mx-auto block h-auto w-auto max-w-[calc(100%-2.5rem)] rounded-[28px] max-h-[52vh] my-5 lg:my-7 lg:max-w-[calc(100%-3.5rem)]"
            style={{ filter: "drop-shadow(0 18px 50px rgba(0,0,0,0.55))" }}
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
  // El historial del navegador no existe en el servidor — arrancar en `false`
  // (igual que SSR) y recién resolver el valor real tras montar evita el
  // mismatch de hidratación (icono/aria-label distintos entre server y cliente).
  const [hasHistory, setHasHistory] = useState(false);
  useEffect(() => {
    setHasHistory(window.history.length > 1);
  }, []);
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
    } catch { }
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
  // Nombre real del promotor; el código queda como fallback mientras carga.
  const { data: promoterInfo } = usePromoterDisplayName(promo);
  const promoterLabel = promoterInfo?.name ?? promo;
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
          Tu compra apoya a <span className="font-medium text-cart-ink-2">{promoterLabel}</span>, que te compartió el link
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

function FeatureGrid({ palette }: { palette: Palette | null }) {
  const borderColor = palette ? palette.dark ?? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.12)";
  // El icono va sobre el fondo de la card — si el acento extraído resulta
  // demasiado oscuro para ese fondo, cae al morado de marca en vez de
  // quedar invisible.
  const iconColor = palette?.accent
    ? ensureContrast(palette.accent, "#12121a", "#7C3AED", 2.5)
    : "#7C3AED";
  // Antes las 3 cards quedaban negras planas (bg-cart-bg-elev fijo) mientras
  // el resto de la página ya estaba tenida — se veían "pegadas" encima.
  // Mezclamos el tinte con el elev oscuro de siempre para que combinen.
  const chipBg = palette?.dark ? mixColors(palette.dark, "#12121a", 0.55) : undefined;

  return (
    <div className="mt-7 grid grid-cols-3 gap-2">
      <FeatureChip
        icon={<YapeMini />}
        label="Yape"
        sub="o tarjeta"
        borderColor={borderColor}
        iconColor={iconColor}
        bg={chipBg}
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
        borderColor={borderColor}
        iconColor={iconColor}
        bg={chipBg}
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
        borderColor={borderColor}
        iconColor={iconColor}
        bg={chipBg}
      />
    </div>
  );
}

function FeatureChip({
  icon,
  label,
  sub,
  borderColor,
  iconColor,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  borderColor?: string;
  iconColor?: string;
  bg?: string;
}) {
  return (
    <div
      className={"flex flex-col items-start gap-1.5 rounded-2xl px-3.5 py-3" + (bg ? "" : " bg-cart-bg-elev/60")}
      style={{ border: `1px solid ${borderColor ?? "rgba(255,255,255,0.12)"}`, background: bg }}
    >
      <span className="text-white" style={{ color: iconColor ?? "#7C3AED" }}>
        {icon}
      </span>
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
      <UserHeader />
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

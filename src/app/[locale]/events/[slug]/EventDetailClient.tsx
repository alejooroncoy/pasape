"use client";

import { ButtonHTMLAttributes, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckoutSheet } from "./_checkout/CheckoutSheet";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { clientEvents } from "@/lib/analytics/clientEvents";
import { api } from "@/lib/_shared/api-client";
import { eventDatePillParts, eventDateTime } from "@/lib/_shared/format";
import { UserHeader } from "@/app/[locale]/_home/UserHeader";
import type { NavUser } from "@/app/[locale]/_home/AppHeader";
import { SignInDrawer } from "@/app/[locale]/_home/SignInDrawer";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useSaveEvent } from "@/lib/identity/hooks/useSaveEvent";
import { useFollow } from "@/lib/identity/hooks/useFollow";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
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
} from "@/lib/_shared/color";
import { Footer } from "@/app/[locale]/_home/Footer";
import type { TicketType } from "@/server/events/domain/Event";
import { VenueLayoutModal } from "@/components/ui/VenueLayoutModal";
import { Sheet } from "@/components/ui/Sheet";
import { PresaleCountdown } from "@/components/ui/PresaleCountdown";
import { activePricing } from "@/lib/events/pricing";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
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
export function EventDetailClient({
  slug,
  initialUser,
}: {
  slug: string;
  /** Sesión resuelta por el server (RSC) → primer render determinista del header. */
  initialUser?: NavUser | null;
}) {
  const { data, isLoading, error } = useEvent(slug);

  // Señal cruda para un futuro motor de recomendaciones (profile_category_views).
  // Best-effort: si no hay sesión el server lo ignora en silencio, y si la red
  // falla acá tampoco debe afectar la vista del evento.
  const categoryViewSent = useRef<string | null>(null);
  useEffect(() => {
    const category = data?.event.category;
    if (!category || categoryViewSent.current === slug) return;
    categoryViewSent.current = slug;
    api.post("/api/identity/category-view", { category }).catch(() => {});
  }, [slug, data?.event.category]);

  const eventViewSent = useRef<string | null>(null);
  useEffect(() => {
    const event = data?.event;
    if (!event || eventViewSent.current === slug) return;
    eventViewSent.current = slug;
    clientEvents.eventView({ event_slug: event.slug, event_id: event.id });
  }, [slug, data?.event]);

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

  // Comparación en vivo de los dos tratamientos del flyer (como /es/2 en el
  // home): ?hero=immersive baña la cabecera con el color del flyer; por defecto
  // "ticket" (póster + talón de datos).
  const heroVariant: "ticket" | "immersive" =
    search.get("hero") === "immersive" ? "immersive" : "ticket";

  const groups = useMemo(
    () => (data ? groupForDetail(data.ticketTypes) : []),
    [data],
  );

  const availability = useMemo(
    () => (data ? eventAvailability(data.ticketTypes) : { freeBoxes: 0, freeSeats: 0, total: 0 }),
    [data],
  );

  const [groupQty, setGroupQty] = useState<Record<string, number>>({});
  // Boxes elegidos por IDENTIDAD (Box A/B/C) — no por cantidad. Se eligen en una
  // hoja inferior (BoxPickerSheet) que muestra el plano como referencia.
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>([]);
  const [boxSheetOpen, setBoxSheetOpen] = useState(false);
  // Reanudar pago tras recargar la URL interceptada: /buy?…&inline=1 (hard-nav)
  // redirige aquí con ?pay=order&k=token. Abrimos la hoja DIRECTO en pago en vez
  // de mostrar la página completa de /buy (evita el salto de UI en el reload).
  const resumePayOrder = search.get("pay");
  const resumePayToken = search.get("k");
  // El paso de datos ("¿Quién va?") se resuelve en un bottom-sheet sobre el
  // evento (no navegando): gratis se completa acá, pagado entrega al pago. Si
  // venimos con ?pay (reanudar), arranca abierto en pago sin efecto extra.
  const [checkoutOpen, setCheckoutOpen] = useState(() => Boolean(resumePayOrder));
  // Ancla del selector (móvil): sin selección, el CTA lleva aquí en vez de a un
  // /buy vacío. La selección vive solo en esta página; /buy es datos + pago.
  const selectorRef = useRef<HTMLDivElement>(null);

  // Dos naturalezas distintas en la misma pantalla: entradas "por persona"
  // (stepper) y boxes (un espacio para el grupo, se reservan enteros). Se
  // separan visualmente y el box se elige en la hoja — nunca se sale de aquí.
  const entradaGroups = useMemo(
    () => groups.filter((g) => !summarizeGroup(g).isAllBoxes),
    [groups],
  );
  const boxGroups = useMemo(
    () => groups.filter((g) => summarizeGroup(g).isAllBoxes),
    [groups],
  );
  const boxItems = useMemo(() => boxGroups.flatMap((g) => g.items), [boxGroups]);
  const selectedBoxes = useMemo(
    () => boxItems.filter((b) => selectedBoxIds.includes(b.id)),
    [boxItems, selectedBoxIds],
  );

  const entradaUnits = useMemo(
    () => Object.values(groupQty).reduce((a, b) => a + b, 0),
    [groupQty],
  );
  const liveUnits = entradaUnits + selectedBoxes.length;

  // Resumen para la barra/botón: entradas y boxes se cuentan por separado (un
  // box NO es "una entrada"). Ej: "2 entradas · 1 box".
  const selectionLabel = useMemo(() => {
    const parts: string[] = [];
    if (entradaUnits > 0) parts.push(`${entradaUnits} ${entradaUnits === 1 ? "entrada" : "entradas"}`);
    const nb = selectedBoxes.length;
    if (nb > 0) parts.push(`${nb} ${nb === 1 ? "box" : "boxes"}`);
    return parts.join(" · ");
  }, [entradaUnits, selectedBoxes.length]);

  const liveTotalCents = useMemo(() => {
    const entradas = entradaGroups.reduce((sum, group) => {
      const qty = groupQty[detailGroupKey(group)] ?? 0;
      const price = summarizeGroup(group).minPriceCents ?? 0;
      return sum + qty * price;
    }, 0);
    // El precio del box es el que ya viene calculado por el backend
    // (buyerPriceCents) — display, no recálculo. El total real lo pisa el quote.
    const boxes = selectedBoxes.reduce((s, b) => s + (b.buyerPriceCents ?? 0), 0);
    return entradas + boxes;
  }, [entradaGroups, groupQty, selectedBoxes]);

  // Precio "desde" del evento (display): el menor precio entre todas las zonas
  // disponibles. Solo para el gancho de la barra cuando el usuario aún no
  // eligió — el total real lo arma el quote del backend en el checkout.
  const fromPriceCents = useMemo(() => {
    const prices = groups
      .map((g) => summarizeGroup(g).minPriceCents)
      .filter((p): p is number => p != null);
    return prices.length ? Math.min(...prices) : null;
  }, [groups]);

  const buyHrefAll = () => {
    const p = new URLSearchParams();
    if (promo) p.set("promo", promo);
    // Desglose "id:cantidad" — el mismo formato `sel` que hidrata /buy y se
    // conserva por el paso de datos hasta el pago. Entradas por cantidad; cada
    // box por su id (siempre :1, se vende entero).
    const sel: string[] = [];
    for (const [key, qty] of Object.entries(groupQty)) {
      if (qty > 0 && key.startsWith("tt:")) sel.push(`${key.slice(3)}:${qty}`);
    }
    for (const id of selectedBoxIds) sel.push(`${id}:1`);
    if (sel.length) p.set("sel", sel.join(","));
    else if (liveUnits > 0) p.set("qty", String(liveUnits));
    const qs = p.toString();
    return `/events/${slug}/buy${qs ? `?${qs}` : ""}`;
  };

  // Selección como {ticketTypeId, qty}[] — entradas por cantidad, cada box :1.
  // Es lo que consume el CheckoutSheet (mismo shape que el quote/buy).
  const checkoutItems = useMemo(() => {
    const out: { ticketTypeId: string; qty: number }[] = [];
    for (const [key, qty] of Object.entries(groupQty)) {
      if (qty > 0 && key.startsWith("tt:")) out.push({ ticketTypeId: key.slice(3), qty });
    }
    for (const id of selectedBoxIds) out.push({ ticketTypeId: id, qty: 1 });
    return out;
  }, [groupQty, selectedBoxIds]);

  // Un solo camino a la compra. Sin selección enfocamos el selector (en móvil el
  // CTA está sobre la barra fija). Con selección abrimos el bottom-sheet de
  // datos sobre el evento — nada de saltar a otra página para el paso de datos.
  const goBuy = (location: string) => {
    if (liveUnits <= 0) {
      selectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // `id` fijo: si toca varias veces no se apilan toasts, solo se refresca.
      toast("Elige alguna entrada para continuar", { id: "pick-first" });
      return;
    }
    clientEvents.checkoutStarted({ event_slug: slug, location });
    setCheckoutOpen(true);
  };

  if (isLoading) return <PageSkeleton initialUser={initialUser} />;
  if (error || !data) {
    return (
      <div className="home-light home-wash min-h-dvh bg-cart-bg text-cart-ink-2">
        <UserHeader initialUser={initialUser} />
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
  // El talón del ticket (variante "ticket" con flyer) ya muestra fecha + lugar,
  // así que ocultamos la línea meta bajo el título para no repetirla.
  const heroStub = heroVariant === "ticket" && Boolean(event.coverUrl);

  return (
    <PageContainer palette={palette}>
      <UserHeader initialUser={initialUser} />
      <div className="mx-auto w-full max-w-[1120px] px-5 lg:px-8">
        <div className="grid gap-8 pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10 lg:pt-8">
          <div className="pb-6 lg:pb-12">
            {/* Flyer contenido (estilo Joinnus): el afiche vertical se ve
                completo — nunca recortado — y un gradiente con los colores
                del propio flyer rellena el marco. */}
            <FlyerCard
              event={event}
              eventId={event.id}
              palette={palette}
              variant={heroVariant}
              fromPriceCents={fromPriceCents}
              isClosed={isClosed}
            />

            {!heroStub && (
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
            )}

            {!heroStub && (
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
            )}

            {promo && <PromoBanner promo={promo} />}

            {/* Jerarquía del comprador peruano: 1) flyer, 2) distribución del
                local, 3) entradas. El plano va ANTES que la descripción — el
                usuario decide su zona mirando el plano, recién ahí compra. */}
            {event.venueLayoutUrl && (
              <VenueLayoutBanner url={event.venueLayoutUrl} venue={event.venue} />
            )}

            {!isClosed && (
              <div ref={selectorRef} className="mt-8 scroll-mt-20 lg:hidden">
                <h2 className="mb-3 text-[19px] font-bold tracking-[-0.02em] text-cart-ink">
                  Elige tu entrada<span className="text-cart-accent">.</span>
                </h2>
                {entradaGroups.length > 0 && (
                  <>
                    {boxGroups.length > 0 && (
                      <TicketSubHeader>Entradas · por persona</TicketSubHeader>
                    )}
                    <GroupCardList
                      groups={entradaGroups}
                      groupQty={groupQty}
                      onGroupQtyChange={(key, qty) =>
                        setGroupQty((prev) => ({ ...prev, [key]: qty }))
                      }
                      onPickGroup={() => {}}
                      palette={palette}
                    />
                  </>
                )}
                {boxGroups.length > 0 && (
                  <BoxSection
                    boxGroups={boxGroups}
                    selectedBoxes={selectedBoxes}
                    onOpen={() => setBoxSheetOpen(true)}
                    onRemove={(id) =>
                      setSelectedBoxIds((ids) => ids.filter((x) => x !== id))
                    }
                  />
                )}
              </div>
            )}

            {event.description && <DescriptionBlock text={event.description} />}

            {/* Productora del evento — lleva a su vitrina (estilo Passline/Luma). */}
            {showcase.data?.org && <OrganizerChip org={showcase.data.org} palette={palette} />}

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
              <AsideContainer palette={palette}>
                {isClosed ? (
                  <EndedPanel org={showcase.data?.org} />
                ) : (
                  <>
                    <AvailabilityHeader availability={availability} palette={palette} />

                    <div className="mt-4">
                      {entradaGroups.length > 0 && (
                        <>
                          {boxGroups.length > 0 && (
                            <TicketSubHeader>Entradas · por persona</TicketSubHeader>
                          )}
                          <GroupCardList
                            groups={entradaGroups}
                            compact
                            groupQty={groupQty}
                            onGroupQtyChange={(key, qty) =>
                              setGroupQty((prev) => ({ ...prev, [key]: qty }))
                            }
                            onPickGroup={() => {}}
                            palette={palette}
                          />
                        </>
                      )}
                      {boxGroups.length > 0 && (
                        <BoxSection
                          compact
                          boxGroups={boxGroups}
                          selectedBoxes={selectedBoxes}
                          onOpen={() => setBoxSheetOpen(true)}
                          onRemove={(id) =>
                            setSelectedBoxIds((ids) => ids.filter((x) => x !== id))
                          }
                        />
                      )}
                    </div>

                    <BuyButton
                      onClick={() => goBuy("sidebar")}
                      palette={palette}
                      disabled={allSoldOut}
                    >
                      {allSoldOut
                        ? "Agotado"
                        : liveUnits > 0
                          ? `${selectionLabel} · ${formatPrice(liveTotalCents, "PEN")}`
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

      <Footer />

      {/* Holgura para que la barra de compra fija (solo móvil) no tape el pie
          del footer. Antes esta holgura vivía como pb-32 en el contenido, pero
          en páginas cortas dejaba un gran vacío entre el contenido y el footer. */}
      <div aria-hidden className="h-28 lg:hidden" />

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-cart-line bg-cart-bg/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <div className="mx-auto px-5 pt-3">
          {!isClosed && !allSoldOut && (
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-[12px] text-cart-ink-3">
                {liveUnits > 0 ? selectionLabel : "Aún sin elegir"}
              </span>
              <span className="text-[14px] font-bold tracking-[-0.01em] text-cart-ink">
                {liveUnits > 0 ? (
                  liveTotalCents <= 0 ? (
                    "Gratis"
                  ) : (
                    <>
                      {formatMoney(liveTotalCents, "PEN")}{" "}
                      {/* liveTotalCents ya es buyerPriceCents (fee horneado): el
                          número ES el precio final, no un subtotal. "+ servicio"
                          mentía (sugería que aún se suma). Alineado con buy/page
                          ("Incluye … de servicio"). */}
                      <span className="text-[10.5px] font-medium text-cart-ink-4">servicio incluido</span>
                    </>
                  )
                ) : fromPriceCents == null ? null : fromPriceCents <= 0 ? (
                  <span className="font-semibold text-cart-ink-3">Gratis</span>
                ) : (
                  <span className="font-semibold text-cart-ink-3">
                    Desde {formatMoney(fromPriceCents, "PEN")}
                  </span>
                )}
              </span>
            </div>
          )}
          <BuyButton
            flush
            onClick={() => goBuy("bottom_bar")}
            palette={palette}
            disabled={isClosed || allSoldOut}
          >
            {isClosed
              ? "Evento terminado"
              : allSoldOut
                ? "Agotado"
                : liveUnits > 0
                  ? "Continuar · Tus datos"
                  : "Comprar entradas"}
          </BuyButton>
        </div>
      </div>

      {boxItems.length > 0 && (
        <BoxPickerSheet
          open={boxSheetOpen}
          onClose={() => setBoxSheetOpen(false)}
          boxGroups={boxGroups}
          venueLayoutUrl={event.venueLayoutUrl}
          selectedIds={selectedBoxIds}
          onConfirm={(ids) => setSelectedBoxIds(ids)}
        />
      )}

      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        eventId={event.id}
        slug={slug}
        items={checkoutItems}
        promo={promo}
        accent={palette?.accent}
        summaryLabel={selectionLabel}
        fallbackTotalCents={liveTotalCents}
        resumePay={
          resumePayOrder ? { orderId: resumePayOrder, orderToken: resumePayToken } : null
        }
      />
    </PageContainer>
  );
}

/** Containers que reciben la paleta ya calculada (una sola vez) desde EventDetailInner. */
function PageContainer({ children }: { palette: Palette | null } & React.PropsWithChildren) {
  // Misma paleta clara del home (scope .home-light + wash): la página del
  // evento ya no se tiñe de oscuro con el flyer — el color del evento vive
  // en el flyer y sus acentos, no en el fondo de toda la pantalla.
  return (
    <div className="home-light home-wash cart-grain min-h-dvh bg-cart-bg text-cart-ink">
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

function AsideContainer({ children }: { palette: Palette | null } & React.PropsWithChildren) {
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev/60 p-5 shadow-[0_2px_14px_-8px_rgba(50,30,120,0.18)]">
      {children}
    </div>
  );
}

function BuyButton({
  children,
  palette,
  disabled,
  flush,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & React.PropsWithChildren & { palette: Palette | null; flush?: boolean }) {
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
      className={
        (flush ? "" : "mt-5 ") +
        "w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_2px_8px_-2px_rgba(50,30,120,0.28)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
      }
      style={
        tinted
          ? { background: palette.accent, boxShadow: `0 2px 8px -2px ${palette.accent}59`, color: textColor }
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
      <h2 className="mt-4 text-[17px] font-bold tracking-[-0.01em] text-cart-ink">
        Este evento ya terminó
      </h2>
      <p className="mt-1.5 text-[13px] leading-snug text-cart-ink-3">
        Las ventas están cerradas. ¡Gracias a todos los que asistieron!
      </p>
      {org && (
        <Link
          href={`/${org.slug}` as never}
          className="mt-5 w-full rounded-full border border-cart-line bg-cart-bg-elev-2 py-3 text-[13.5px] font-semibold text-cart-ink transition hover:border-cart-line-strong"
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
  // El avatar sin logo conserva el degradado de la paleta del flyer; la card
  // en sí es clara, como el resto de la página.
  const bgStart = palette?.mid ?? palette?.dark ?? org.brandColor ?? "#7C3AED";
  const bgEnd = palette?.dark ?? "#1A0A2E";

  return (
    <div className="mt-7 flex items-center gap-3 border-t border-cart-line pt-5">
      <Link href={`/${org.slug}` as never} className="group flex min-w-0 flex-1 items-center gap-3">
        <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-cart-bg-elev-2">
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
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-cart-ink group-hover:underline">
              {org.name}
            </span>
            {org.verified && <VerifiedSeal />}
          </div>
          <div className="mt-0.5 text-[11.5px] text-cart-ink-3">
            Organizador
            {org.eventCount > 0
              ? ` · ${org.eventCount} ${org.eventCount === 1 ? "evento" : "eventos"}`
              : ""}
          </div>
        </div>
      </Link>
      <FollowButton org={org} />
    </div>
  );
}

// Sello de organizador verificado (curado por Pasape) — glifo de check en disco,
// como IG/X. Solo se muestra si el backend marca la org como verified.
function VerifiedSeal() {
  return (
    <svg
      className="shrink-0"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      role="img"
      aria-label="Organizador verificado"
    >
      <path
        fill="#4f6df5"
        d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.8-1 3 1 3-2.6 1.8-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3L2.6 16l1-3-1-3 2.6-1.8 1-3 3.2.1z"
      />
      <path fill="#fff" d="M10.6 14.6l-2.2-2.2-1.3 1.3 3.5 3.5 6-6-1.3-1.3z" />
    </svg>
  );
}

// Botón "Seguir" real (useFollow). Invitado → login-gate en el sitio y vuelve al
// evento. Invitado → abre el SignInDrawer (bottom-sheet en móvil, modal en
// desktop) sin salir de la página; al loguear vuelve acá (redirectTo). Antes
// navegaba a la vitrina de la org, un desvío confuso: clicabas "Seguir" y
// aterrizabas en otra página sin haber seguido nada.
function FollowButton({ org }: { org: ShowcaseOrg }) {
  const pathname = usePathname();
  const me = useCurrentUser();
  const loggedIn = !!me.data?.user;
  const { isFollowing, toggle, isPending } = useFollow(org.id);
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!loggedIn) {
            setSignInOpen(true);
            return;
          }
          toggle();
        }}
        disabled={isPending}
        aria-pressed={isFollowing}
        className={
          "flex-none rounded-lg px-4 py-2 text-[12.5px] font-semibold transition disabled:opacity-60 " +
          (isFollowing
            ? "border border-cart-line bg-cart-bg-elev-2 text-cart-ink-3"
            : "border border-cart-line-strong bg-cart-bg text-cart-ink hover:border-cart-ink-4")
        }
      >
        {isFollowing ? "Siguiendo" : "Seguir"}
      </button>
      <SignInDrawer
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        redirectTo={pathname}
      />
    </>
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
  // Panel claro: verdes/rojos oscuros que contrastan sobre la superficie
  // lavanda del aside (los pasteles de la versión dark se perdían).
  const bg = "#f3f1fb";
  const availableColor = ensureContrast("#059669", bg, "#047857", 4.5);
  const soldOutColor = ensureContrast("#e11d48", bg, "#be123c", 4.5);

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
  // Card clara (paleta del home): el acento del flyer solo se usa si contrasta
  // sobre superficie lavanda; si no, morado de marca.
  const cardBg = "#f3f1fb";
  const cardAccent = palette?.accent ? ensureContrast(palette.accent, cardBg, "#7c3aed", 4.5) : "#7c3aed";
  const stepperTextColor = readableTextColor(cardAccent);
  const badgeColor = ensureContrast("#059669", cardBg, "#047857", 4.5);

  // "Un solo mecanismo": la CARD solo es clickeable para boxes — necesitan el
  // picker para elegir A/B/C. Las entradas individuales se agregan con el
  // stepper y punto; tocar la card no navega, así no compiten dos caminos de
  // compra (el único camino a pagar es el botón "Comprar" del pie/lateral).
  const cardActs = summary.isAllBoxes && !summary.isAllSoldOut;

  return (
    <div
      role={cardActs ? "button" : undefined}
      tabIndex={cardActs ? 0 : undefined}
      onClick={cardActs ? onClick : undefined}
      onKeyDown={cardActs ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      aria-disabled={summary.isAllSoldOut}
      className={
        "group flex w-full items-stretch rounded-2xl border bg-cart-bg-elev text-left transition " +
        (summary.isAllSoldOut
          ? "border-cart-line opacity-55 cursor-not-allowed"
          : qty > 0
            ? "shadow-[0_0_16px_-6px_var(--color-cart-accent-glow)]"
            : "border-cart-line" + (cardActs ? " cursor-pointer hover:border-cart-line-strong hover:bg-cart-bg-elev/80" : "")) +
        (compact ? " px-3.5 py-3" : " px-4 py-4")
      }
      style={{
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
              className="rounded-md bg-emerald-600/12 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]"
              style={{ color: badgeColor }}
            >
              Gratis
            </span>
          ) : ap?.isPresale && (
            <span
              className="rounded-md bg-emerald-600/12 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]"
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
        {ap?.showCountdown && ap.countdownEndsAt ? (
          <div className="mt-1">
            <PresaleCountdown endsAt={ap.countdownEndsAt} />
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
        {/* Contador +/- solo para entradas individuales. Un box NO se cuenta:
            se reserva por identidad (A/B/C) en el picker, no con un stepper —
            un "box × 2" no dice CUÁLES dos. Los grupos de box caen al "Ver ›"
            que abre el picker (onClick del card). */}
        {!summary.isAllSoldOut && onQtyChange && !summary.isAllBoxes ? (
          <div className="mt-2 flex items-center gap-1.5">
            {qty > 0 ? (
              <>
                <motion.button
                  type="button"
                  onClick={(e) => handleCounterClick(e, -1)}
                  whileTap={{ scale: 0.8 }}
                  className="grid size-7 place-items-center rounded-full border border-cart-line bg-cart-bg-elev-2 text-cart-ink transition hover:border-cart-line-strong"
                  aria-label="Quitar una entrada"
                >
                  <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
                    <path d="M1 1h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </motion.button>
                <motion.span
                  key={qty}
                  initial={{ scale: 0.35, opacity: 0.2 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 750, damping: 18, mass: 0.5 }}
                  className={compact ? "w-4 text-center text-[13px] font-bold" : "w-5 text-center text-[14px] font-bold"}
                >
                  {qty}
                </motion.span>
                <motion.button
                  type="button"
                  onClick={(e) => handleCounterClick(e, +1)}
                  disabled={qty >= maxQty}
                  whileTap={{ scale: 0.8 }}
                  className="grid size-7 place-items-center rounded-full transition hover:brightness-110 disabled:opacity-40"
                  style={{ background: cardAccent, color: stepperTextColor }}
                  aria-label="Agregar una entrada"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </motion.button>
              </>
            ) : (
              <motion.button
                type="button"
                onClick={(e) => handleCounterClick(e, +1)}
                whileTap={{ scale: 0.93 }}
                className={
                  "rounded-full border px-3 py-1 transition hover:brightness-125 " +
                  (compact ? "text-[11px]" : "text-[12px]") +
                  " font-semibold"
                }
                style={{ borderColor: `${cardAccent}cc`, background: `${cardAccent}1f`, color: cardAccent }}
                aria-label="Seleccionar esta zona"
              >
                + Elegir
              </motion.button>
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

/* ============================== Boxes (sección + hoja) ============================== */

function TicketSubHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-1 flex items-center gap-2.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-cart-ink-3">
        {children}
      </span>
      <span className="h-px flex-1 bg-cart-line" />
    </div>
  );
}

function nounCap(noun: string): string {
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

// Sección de boxes en el detalle: distinta de las entradas (un espacio para el
// grupo, se reserva entero). Los boxes elegidos se ven como chips con ✕ (quitar
// de un toque) + "otro box"; el botón abre la hoja — nunca se sale de la página.
function BoxSection({
  boxGroups,
  selectedBoxes,
  onOpen,
  onRemove,
  compact,
}: {
  boxGroups: TicketGroup[];
  selectedBoxes: TicketType[];
  onOpen: () => void;
  onRemove: (id: string) => void;
  compact?: boolean;
}) {
  const summ = boxGroups.map((g) => summarizeGroup(g));
  const free = summ.reduce((s, x) => s + x.freeBoxes, 0);
  const total = summ.reduce((s, x) => s + x.totalBoxes, 0);
  const noun = summ[0]?.noun ?? "box";
  const allItems = boxGroups.flatMap((g) => g.items);
  const prices = summ.map((x) => x.minPriceCents).filter((p): p is number => p != null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const hasSel = selectedBoxes.length > 0;
  const soldOut = free === 0 && !hasSel;

  return (
    <div className="mt-4">
      <TicketSubHeader>Boxes · un espacio para tu grupo</TicketSubHeader>
      <div
        className={"rounded-2xl border bg-cart-bg-elev " + (compact ? "px-3.5 py-3.5" : "px-4 py-4")}
        style={{ borderColor: "color-mix(in srgb, var(--color-cart-accent-2) 30%, transparent)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold tracking-[-0.01em] text-cart-ink">
            {nounCap(unitNounPlural(noun))}
          </span>
          {minPrice != null && (
            <span className="whitespace-nowrap text-[13px] font-bold tracking-[-0.01em] text-cart-ink">
              {minPrice <= 0 ? "Gratis" : formatMoney(minPrice, "PEN")}
              <span className="ml-1 text-[10px] font-medium text-cart-ink-4">c/u</span>
            </span>
          )}
        </div>

        <BoxAvailabilityBar items={allItems} className="mt-2.5" />

        {hasSel ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {selectedBoxes.map((b) => {
                // Evita "Box Box A": si el label del organizador ya empieza con
                // el sustantivo (box/mesa…), se usa tal cual; si es corto ("A"),
                // se le antepone el sustantivo para dar contexto.
                const raw = b.boxLabel ?? b.name;
                const label = !b.boxLabel
                  ? b.name
                  : raw.toLowerCase().startsWith(noun.toLowerCase())
                    ? raw
                    : `${nounCap(noun)} ${raw}`;
                return (
                <motion.span
                  key={b.id}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 480, damping: 30, mass: 0.6 }}
                  className="inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-1.5 text-[12.5px] font-bold text-cart-accent"
                  style={{
                    background: "color-mix(in srgb, var(--color-cart-accent) 10%, transparent)",
                    borderColor: "color-mix(in srgb, var(--color-cart-accent) 32%, transparent)",
                  }}
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => onRemove(b.id)}
                    aria-label={`Quitar ${label}`}
                    className="grid size-[19px] place-items-center rounded-full text-cart-accent transition hover:bg-cart-accent hover:text-white active:scale-90"
                    style={{ background: "color-mix(in srgb, var(--color-cart-accent) 18%, transparent)" }}
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                      <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </motion.span>
                );
              })}
            </AnimatePresence>
            {free > 0 && (
              <motion.button
                layout="position"
                type="button"
                onClick={onOpen}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 480, damping: 30, mass: 0.6 }}
                className="inline-flex items-center gap-1 rounded-full border border-dashed px-3.5 py-1.5 text-[12.5px] font-bold text-cart-accent transition"
                style={{ borderColor: "color-mix(in srgb, var(--color-cart-accent) 45%, transparent)" }}
              >
                + Otro {noun}
              </motion.button>
            )}
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[12px] text-cart-ink-3">
              {soldOut ? "Agotado" : `${free} de ${total} libres`}
            </span>
            {!soldOut && (
              <button
                type="button"
                onClick={onOpen}
                className="rounded-full border px-4 py-1.5 text-[12.5px] font-bold text-cart-accent transition hover:brightness-110"
                style={{
                  background: "color-mix(in srgb, var(--color-cart-accent) 8%, transparent)",
                  borderColor: "color-mix(in srgb, var(--color-cart-accent) 40%, transparent)",
                }}
              >
                Reservar {noun}
              </button>
            )}
          </div>
        )}

        <p className={"leading-snug text-cart-ink-3 " + (compact ? "mt-2 text-[10.5px]" : "mt-2.5 text-[11px]")}>
          Reservas el {noun} entero para tu grupo; luego repartes las entradas.
        </p>
      </div>
    </div>
  );
}

// Hoja inferior para elegir box(es) por identidad. Multi-selección; muestra el
// plano del local como referencia visual (es solo imagen: no hay regiones
// clickeables mapeadas a cada box, se elige por su etiqueta A/B/C).
function BoxPickerSheet({
  open,
  onClose,
  boxGroups,
  venueLayoutUrl,
  selectedIds,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  boxGroups: TicketGroup[];
  venueLayoutUrl: string | null;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
}) {
  const [pending, setPending] = useState<string[]>(selectedIds);
  const [planoOpen, setPlanoOpen] = useState(false);
  // Al abrir, arranca desde la selección actual (para editar/agregar). Al cerrar
  // la hoja, cierra también el plano ampliado.
  useEffect(() => {
    if (open) setPending(selectedIds);
    else setPlanoOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) =>
    setPending((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const multiNoun = boxGroups.length > 1;

  return (
    <>
      {/* Primitivo Sheet compartido: bottom-sheet en móvil, MODAL centrado en
          desktop — misma experiencia que el resto (scrim, a11y, cierre) sin
          reimplementar un drawer a mano. */}
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title="Elige tu box"
        description="Un espacio para tu grupo — toca los que quieras"
        maxWidth={520}
        footer={
          <button
            type="button"
            onClick={() => {
              onConfirm(pending);
              onClose();
            }}
            className="w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(50,30,120,0.28)] transition hover:brightness-110 active:scale-[0.99]"
          >
            {pending.length === 0
              ? "Listo"
              : pending.length === 1
                ? "Confirmar · 1 box"
                : `Confirmar · ${pending.length} boxes`}
          </button>
        }
      >
        {/* Encabezado visible (el title del Sheet es sr-only). */}
        <div className="mb-3">
          <h3 className="text-[16.5px] font-bold tracking-[-0.01em] text-cart-ink">Elige tu box</h3>
          <p className="mt-0.5 text-[12px] text-cart-ink-3">
            Un espacio para tu grupo — toca los que quieras
          </p>
        </div>
          {/* Solo si el organizador subió una imagen de distribución. Tira
              compacta (no empuja el grid) — "Ampliar" la abre a pantalla
              completa con zoom (reusa VenueLayoutModal). */}
          {venueLayoutUrl && (
            <button
              type="button"
              onClick={() => setPlanoOpen(true)}
              aria-label="Ampliar distribución del local"
              className="relative mb-4 block w-full overflow-hidden rounded-xl border border-cart-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={venueLayoutUrl}
                alt="Distribución del local"
                className="h-[104px] w-full object-cover"
              />
              <span
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(90deg, rgba(8,5,16,0) 45%, rgba(8,5,16,0.4) 100%)" }}
              />
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-bold text-cart-ink shadow-[0_3px_10px_rgba(0,0,0,0.3)]">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path d="M3 7V3h4M13 9v4h-4M3 3l4.5 4.5M13 13l-4.5-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Ampliar
              </span>
              <span
                className="absolute bottom-2 left-2.5 flex items-center gap-1.5 text-[10px] font-semibold text-white"
                style={{ textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}
              >
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path d="M7 12.5S2.8 8.8 2.8 5.8a4.2 4.2 0 118.4 0c0 3-4.2 6.7-4.2 6.7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <circle cx="7" cy="5.8" r="1.4" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                Distribución del local
              </span>
            </button>
          )}

          {boxGroups.map((g, gi) => {
            const noun = summarizeGroup(g).noun;
            return (
              <div key={gi} className={gi > 0 ? "mt-4" : ""}>
                {multiNoun && (
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-cart-ink-3">
                    {nounCap(unitNounPlural(noun))}
                  </div>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {g.items.map((b) => {
                    const soldout = ticketStatus(b).kind === "soldout";
                    const sel = pending.includes(b.id);
                    const seats = b.kind === "box" ? b.seats : 0;
                    return (
                      <motion.button
                        key={b.id}
                        type="button"
                        disabled={soldout}
                        onClick={() => toggle(b.id)}
                        aria-pressed={sel}
                        initial={false}
                        whileTap={soldout ? undefined : { scale: 0.9 }}
                        animate={sel && !soldout ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className={
                          "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-cart-ink transition-[border-color,background,color] " +
                          (soldout
                            ? "cursor-not-allowed border-cart-line bg-cart-bg-elev/50 text-cart-ink-4 line-through"
                            : sel
                              ? "text-cart-accent"
                              : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong")
                        }
                        style={
                          sel && !soldout
                            ? {
                                borderColor: "var(--color-cart-accent)",
                                background: "color-mix(in srgb, var(--color-cart-accent) 12%, transparent)",
                                boxShadow: "0 6px 16px -8px var(--color-cart-accent-glow)",
                              }
                            : undefined
                        }
                      >
                        <span className="text-[15px] font-extrabold tracking-[-0.02em]">
                          {b.boxLabel ?? b.name}
                        </span>
                        {seats > 0 && (
                          <span className="text-[9px] font-medium text-cart-ink-4">{seats} pers.</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </Sheet>

      {venueLayoutUrl && (
        <VenueLayoutModal
          open={planoOpen}
          onOpenChange={setPlanoOpen}
          url={venueLayoutUrl}
          caption="Distribución del local · referencia"
        />
      )}
    </>
  );
}

/* ============================== Hero ============================== */

function FlyerCard({
  event,
  eventId,
  palette,
  variant,
  fromPriceCents,
  isClosed,
}: {
  event: {
    title: string;
    coverUrl: string | null;
    timezone: string;
    startsAt: string;
    venue: string | null;
  };
  eventId: string;
  palette: Palette | null;
  /** "ticket" = póster + talón con título/datos; "immersive" = color del flyer baña la cabecera. */
  variant: "ticket" | "immersive";
  fromPriceCents: number | null;
  isClosed: boolean;
}) {
  // Si la URL del flyer 404ea o falla la carga (link roto, storage caído),
  // no queremos el ícono de imagen rota del navegador ocupando el marco —
  // se trata igual que "sin flyer": cae al gradiente de marca.
  const [imgFailed, setImgFailed] = useState(false);
  const hasCover = Boolean(event.coverUrl) && !imgFailed;
  const immersive = variant === "immersive";
  const dt = eventDatePillParts(event.startsAt, event.timezone);

  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-cart-line bg-cart-bg-elev lg:rounded-[28px]">
      {hasCover ? (
        // Inmersivo: el propio flyer difuminado baña toda la cabecera con su
        // color (Posh). Ticket: apenas un tinte, el póster manda en card clara.
        <div
          className={
            "absolute inset-0 scale-110 bg-cover bg-center blur-2xl " +
            (immersive ? "opacity-80 saturate-150" : "opacity-30 saturate-125")
          }
          style={{
            backgroundImage: `url("${optimizeImageUrl(event.coverUrl, "hero-blur") ?? event.coverUrl}")`,
          }}
        />
      ) : (
        // Sin flyer (o falló la carga) → gradiente de marca.
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(140deg, #4B1F9A 0%, #7C3AED 40%, #FF4D5E 90%)",
          }}
        />
      )}
      {/* Scrim: en ticket es claro (mantiene el marco en la paleta clara);
          en inmersivo es oscuro y sutil, para dar profundidad sin apagar el color. */}
      <div
        className="absolute inset-0"
        style={{
          background: immersive
            ? "linear-gradient(180deg, rgba(12,7,20,0.12) 0%, rgba(12,7,20,0) 42%, rgba(12,7,20,0.28) 100%)"
            : "linear-gradient(180deg, rgba(251,250,255,0.4) 0%, rgba(251,250,255,0) 32%, rgba(251,250,255,0.6) 100%)",
        }}
      />

      <div className={"relative w-full " + (hasCover ? "" : "aspect-[16/10]")}>
        {hasCover && (
          // La imagen SIEMPRE se ve completa (object-contain), limitada por el
          // ancho del panel y por una altura máxima. El panel se ajusta a ella y
          // el blur-fill rellena cualquier hueco (afiches verticales). Nunca se
          // recorta, ni en móvil ni en desktop. Si falla la carga, `onError`
          // desmonta el <img> y cae al gradiente de marca (evita el ícono roto).
          // `width`/`height` son solo una proporción de referencia (4:5, la
          // típica de un flyer vertical) — el navegador la usa para reservar
          // el espacio MIENTRAS carga (evita el salto/recuadro chico) y, una
          // vez la imagen real carga, su proporción real manda igual (esto no
          // cambia el resultado final con h-auto/w-auto, solo el estado previo).
          // Nítida → preset propio "event-hero" (más ancho que el "hero-lcp"
          // del carrusel del home: este flyer se ve mucho más grande, sobre
          // todo en desktop, y con "hero-lcp" se vería pixelado).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizeImageUrl(event.coverUrl, "event-hero") ?? event.coverUrl ?? undefined}
            alt={event.title}
            width={864}
            height={1080}
            onError={() => setImgFailed(true)}
            className="relative z-[1] mx-auto block h-auto w-auto max-w-[calc(100%-2.5rem)] rounded-[20px] max-h-[52vh] my-5 lg:my-7 lg:max-w-[calc(100%-3.5rem)] object-contain"
            style={{
              filter: immersive
                ? "drop-shadow(0 18px 44px rgba(0,0,0,0.5))"
                : "drop-shadow(0 8px 22px rgba(40,20,90,0.18))",
            }}
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

      {/* Talón del ticket: el póster, el NOMBRE y los datos son un solo objeto
          (una entrada física completa). Corte perforado + título + fecha +
          precio. Solo en la variante "ticket" — el título grande de abajo se
          oculta para no repetirlo. */}
      {variant === "ticket" && hasCover && (
        <div className="relative">
          {/* Perforación: círculos centrados en el borde — la mitad de afuera la
              recorta el overflow-hidden de la card, dejando la muesca. */}
          <span className="absolute left-0 top-0 z-[2] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cart-bg" />
          <span className="absolute right-0 top-0 z-[2] size-4 translate-x-1/2 -translate-y-1/2 rounded-full bg-cart-bg" />
          <span className="absolute inset-x-4 top-0 -translate-y-1/2 border-t-2 border-dashed border-cart-line-strong" />
          <div
            className="px-5 py-4"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-cart-accent) 6%, var(--color-cart-bg-elev)) 0%, var(--color-cart-bg-elev) 100%)",
            }}
          >
            <h1 className="text-[20px] font-bold leading-[1.14] tracking-[-0.02em] text-cart-ink sm:text-[23px] lg:text-[27px]">
              {event.title}
            </h1>
            <div className="mt-3 flex items-center gap-4">
              <div className="text-center leading-none">
                <div className="text-[26px] font-extrabold tracking-[-0.03em] text-cart-ink">
                  {dt.day}
                </div>
                <div className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-cart-accent">
                  {dt.month}
                </div>
              </div>
              <div className="h-9 w-px bg-cart-line-strong" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold tracking-[-0.01em] text-cart-ink">
                  {dt.weekday} · {dt.time}
                </div>
                {event.venue && (
                  <div className="mt-0.5 truncate text-[11.5px] text-cart-ink-3">{event.venue}</div>
                )}
              </div>
              {fromPriceCents != null && (
                <div className="text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-cart-ink-4">
                    Desde
                  </div>
                  <div className="text-[15px] font-bold tracking-[-0.02em] text-cart-ink">
                    {fromPriceCents <= 0 ? "Gratis" : formatMoney(fromPriceCents, "PEN")}
                  </div>
                </div>
              )}
            </div>
            {isClosed && <EndedBadge />}
          </div>
        </div>
      )}
    </div>
  );
}

// Botón de chrome sobre el flyer: blanco SÓLIDO (nada de translúcido + blur, que
// funcionaba como vidrio esmerilado y absorbía el morado/magenta del flyer) +
// sombra y ring para separarlo. Contrasta sobre cualquier flyer sin teñirse.
const HERO_BTN =
  "grid size-10 place-items-center rounded-full bg-white text-cart-ink shadow-[0_4px_14px_-3px_rgba(45,25,90,0.28)] ring-1 ring-black/[0.03] transition hover:bg-white/95";

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
      className={HERO_BTN}
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
  const handleToggle = () => {
    clientEvents.eventSaved({ event_id: eventId, saved: !isSaved });
    toggle();
  };
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      aria-label={isSaved ? "Quitar de favoritos" : "Guardar en favoritos"}
      aria-pressed={isSaved}
      className={HERO_BTN + " active:scale-90 disabled:opacity-60"}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 18 18"
        fill={isSaved ? "var(--color-cart-accent)" : "none"}
        className={isSaved ? "text-cart-accent" : "text-cart-ink"}
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
        clientEvents.eventShared({ method: "native_share" });
      } catch {
        /* user cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(window.location.href);
      clientEvents.eventShared({ method: "clipboard" });
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
        className={HERO_BTN}
      >
        {/* Icono de compartir universal (nodos conectados) — más claro que el
            glifo iOS (caja + flecha), que muchos no reconocen. */}
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
          <circle cx="13.5" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="4.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="13.5" cy="14" r="2.2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.4 7.9l5-2.8M6.4 10.1l5 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
  const { day, month, weekday, time } = eventDatePillParts(startsAt.toISOString(), timezone);

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

// Franja de confianza como las ticketeras (Joinnus/Teleticket): respaldo a la
// izquierda y métodos de pago REALES a la derecha (logos, no texto).
function FeatureGrid() {
  return (
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cart-line bg-cart-bg-elev/40 px-4 py-3">
      <span className="inline-flex items-center gap-2.5 text-[12.5px] font-semibold text-cart-ink">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg"
          style={{ background: "rgba(5,150,105,0.12)", color: "#047857" }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
        <span className="leading-tight">
          Compra 100% segura
          <span className="block text-[10.5px] font-medium text-cart-ink-3">
            Tu entrada llega al instante por QR
          </span>
        </span>
      </span>
      <div className="flex items-center gap-1.5">
        <span className="grid h-7 min-w-[42px] place-items-center rounded-md border border-cart-line-strong bg-white px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/yape.png" alt="Yape" className="h-4 w-auto object-contain" />
        </span>
        <span className="grid h-7 min-w-[42px] place-items-center rounded-md border border-cart-line-strong bg-white px-2">
          <svg width="38" height="13" viewBox="0 0 52 17" aria-label="Visa">
            <text x="26" y="14" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontStyle="italic" fontWeight="800" fontSize="16" fill="#1a1f71" letterSpacing="0.5">VISA</text>
          </svg>
        </span>
        <span className="grid h-7 min-w-[42px] place-items-center rounded-md border border-cart-line-strong bg-white px-2">
          <svg width="30" height="19" viewBox="0 0 40 25" aria-label="Mastercard">
            <circle cx="15.5" cy="12.5" r="8.5" fill="#EB001B" />
            <circle cx="24.5" cy="12.5" r="8.5" fill="#F79E1B" />
            <path d="M20 6.2a8.5 8.5 0 0 1 0 12.6 8.5 8.5 0 0 1 0-12.6z" fill="#FF5F00" />
          </svg>
        </span>
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
                <span className="text-[12px] font-semibold text-cart-ink-3 transition group-hover:text-cart-ink">
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

function PageSkeleton({ initialUser }: { initialUser?: NavUser | null }) {
  return (
    <div className="home-light home-wash min-h-dvh bg-cart-bg text-cart-ink">
      <UserHeader initialUser={initialUser} />
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

/* ============================== Date helper ============================== */

function formatLongDate(d: Date, timezone: string): string {
  return eventDateTime(d.toISOString(), timezone);
}

// Marcamos como referenciado para evitar warning de unused export entre archivos.
export type { TicketType };

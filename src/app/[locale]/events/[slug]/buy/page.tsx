"use client";

import { Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";

// Resetea el scroll ANTES del paint (sin destello). Isomórfico: en SSR cae a
// useEffect para no disparar el warning de useLayoutEffect en el server.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
import { useRouter } from "@/i18n/navigation";
import { UserHeader } from "@/app/[locale]/_home/UserHeader";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useBuyTickets, useOrderQuote } from "@/lib/tickets/hooks/useTickets";
import type { OrderQuote } from "@/server/tickets/domain/Ticket";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useDniLookup } from "@/lib/identity/hooks/useDniLookup";
import { usePromoterDisplayName } from "@/lib/promoters/hooks/usePromoter";
import { formatMoney, formatPrice } from "@/lib/_shared/format";
import { Price } from "@/components/ui/Price";
import { CardForm } from "@/components/payments/CardForm";
import { YapeForm } from "@/components/payments/YapeForm";
import { PhoneField } from "@/components/design/PhoneField";
import { parseE164 } from "@/lib/phone/countries";
import { isValidDocument } from "@/lib/identity/document";
import { PresaleCountdown, shouldCountdown } from "@/components/ui/PresaleCountdown";
import type { TicketType } from "@/server/events/domain/Event";
import {
  boxSeats,
  capitalize,
  groupBoxesByNoun,
  stockTotal,
  type TicketGroup,
  ticketStatus,
  ticketSubtitle,
  unitNoun,
  unitNounPlural,
} from "@/lib/events/ticketDisplay";
import { activePricing, applyPromos } from "@/lib/events/pricing";

type Props = { params: Promise<{ slug: string }> };
type Phase = "pick" | "data" | "pay";

// Ventana de reserva del checkout — debe coincidir con el cron de expiración del
// backend (migración 20260608110000_event_stats_and_order_expiry.sql).
const RESERVATION_MS = 30 * 60 * 1000;

const BUY_ERRORS: Record<string, string> = {
  promoter_quota_exceeded: "El promotor ya agotó su cuota de entradas. Ingresa directo al evento.",
  self_purchase_blocked: "No puedes comprar con tu propio código de promotor.",
};
const buyErrorMsg = (raw: string) => BUY_ERRORS[raw] ?? raw;

export default function BuyFlowPage(props: Props) {
  return (
    <Suspense fallback={<PageLoader />}>
      <BuyFlowInner {...props} />
    </Suspense>
  );
}

function BuyFlowInner({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const { data } = useEvent(slug);
  const me = useCurrentUser();
  const buy = useBuyTickets();
  const quote = useOrderQuote();
  // Quote autoritativo del backend (modelo híbrido): el cálculo local da
  // feedback instantáneo al armar el carrito; en cada transición de paso el
  // server cotiza y sus números pisan los locales. Se guarda junto a la firma
  // del carrito que cotizó — si el carrito cambia, la cotización deja de
  // aplicar sola (se deriva null) sin necesidad de effects.
  const [quoted, setQuoted] = useState<{ sig: string; quote: OrderQuote } | null>(null);
  const search = useSearchParams();
  const [phase, setPhase] = useState<Phase>("pick");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [, setPreferenceId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  // Reserva: al crear la orden (pending) el stock queda apartado 30 min. Si no
  // se paga, el backend la expira (pg_cron) y libera el stock. En el cliente
  // mostramos el countdown y, al vencer, un popover para reintentar o salir.
  const [reservedAt, setReservedAt] = useState<number | null>(null);
  const [reservationExpired, setReservationExpired] = useState(false);
  const [payMethod, setPayMethod] = useState<"yape" | "mp">("yape");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestDni, setGuestDni] = useState("");
  // Extranjero: no tiene DNI peruano → usa pasaporte/documento (alfanumérico,
  // sin RENIEC). El tipo para Mercado Pago se deduce del formato en el server.
  const [isForeigner, setIsForeigner] = useState(false);
  const [guestPhone, setGuestPhone] = useState("");
  const nameTouchedRef = useRef(false);
  const { lookup: dniLookup, pending: dniPending } = useDniLookup();
  const [dniHint, setDniHint] = useState<"idle" | "not_found">("idle");

  // Autorrelleno para logueados: los datos de la cuenta (nombre, DNI, WhatsApp,
  // email) pre-llenan el formulario pero siguen editables — la primera compra
  // los pide y los persiste; las siguientes solo se confirman.
  const prefilledRef = useRef(false);
  useEffect(() => {
    const u = me.data?.user;
    if (!u || prefilledRef.current) return;
    prefilledRef.current = true;
    if (u.fullName) {
      nameTouchedRef.current = true; // que RENIEC no pise el nombre de la cuenta
      setGuestName((prev) => prev || u.fullName!);
    }
    if (u.dni) setGuestDni((prev) => prev || u.dni!);
    if (u.phone) setGuestPhone((prev) => prev || u.phone!);
    if (u.email) setGuestEmail((prev) => prev || u.email!);
  }, [me.data?.user]);

  useEffect(() => {
    // Pasaporte extranjero: no hay RENIEC (es un padrón peruano) → sin lookup.
    if (isForeigner || guestDni.length !== 8) {
      setDniHint("idle");
      return;
    }
    const t = setTimeout(async () => {
      const res = await dniLookup(guestDni);
      if (!res) {
        setDniHint("not_found");
        return;
      }
      setDniHint("idle");
      if (!nameTouchedRef.current) setGuestName(res.fullName);
    }, 600);
    return () => clearTimeout(t);
  }, [guestDni, dniLookup, isForeigner]);

  useEffect(() => {
    const key = `pasape:promo:${slug}`;
    const fromUrl = search.get("promo");
    let next: string | null = null;
    try {
      if (fromUrl) {
        // Last-click wins: el último promotor que convenció al comprador gana.
        next = fromUrl;
        window.localStorage.setItem(key, fromUrl);
      } else {
        next = window.localStorage.getItem(key);
      }
    } catch {}
    if (next) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPromoCode(next);
    }
  }, [slug, search]);

   
  useEffect(() => {
    const orderFromUrl = search.get("order");
    if (!orderFromUrl) return;
    try {
      const raw = sessionStorage.getItem(`pasape:buy:${orderFromUrl}`);
      if (!raw) return;
      const restored = JSON.parse(raw) as {
        qty: Record<string, number>;
        payMethod: "yape" | "mp";
        guestEmail: string;
        guestName: string;
        guestDni: string;
        guestPhone: string;
      };
      setQty(restored.qty ?? {});
      setPayMethod(restored.payMethod ?? "yape");
      setGuestEmail(restored.guestEmail ?? "");
      setGuestName(restored.guestName ?? "");
      setGuestDni(restored.guestDni ?? "");
      setGuestPhone(restored.guestPhone ?? "");
      setOrderId(orderFromUrl);
      setPhase("pay");
    } catch {}
  }, []);

  // Al entrar a comprar, partir desde el inicio (no heredar el scroll del
  // detalle). Antes del paint para que sea imperceptible (sin destello).
  useIsomorphicLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  // "Hay más abajo": un sentinel marca el FINAL real del contenido (el espacio
  // de seguridad del CTA va debajo de él, así no cuenta como contenido). Si el
  // sentinel está por debajo de la zona visible (excluyendo el alto del CTA),
  // mostramos la pista. Solo aparece cuando de verdad falta ver algo.
  const [moreBelow, setMoreBelow] = useState(false);
  const contentEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = contentEndRef.current;
    if (!el) {
      setMoreBelow(false);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setMoreBelow(!entry.isIntersecting),
      // -96px abajo ≈ alto del CTA sticky: el sentinel "cuenta como visible"
      // solo cuando queda por encima del botón.
      { root: null, rootMargin: "0px 0px -96px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [phase]);

  // Selección inicial desde el detalle: ?qty=N (+ opcional ?tt=id). Sin esto, la
  // cantidad elegida en la página del evento se perdía al entrar a /buy.
  const initSelRef = useRef(false);
  useEffect(() => {
    if (initSelRef.current || !data) return;
    if (search.get("order")) {
      initSelRef.current = true; // el flujo de restaurar orden ya setea qty
      return;
    }
    // ?sel = selección completa por tipo "id:cantidad,id:cantidad" (cuando se
    // eligen varias entradas distintas en el detalle). Preserva el desglose.
    const selParam = search.get("sel");
    if (selParam) {
      const next: Record<string, number> = {};
      for (const part of selParam.split(",")) {
        const [id, q] = part.split(":");
        const n = parseInt(q ?? "", 10);
        if (id && Number.isFinite(n) && n > 0 && data.ticketTypes.some((tt) => tt.id === id)) {
          next[id] = n;
        }
      }
      initSelRef.current = true;
      if (Object.keys(next).length) {
        setQty((prev) => (Object.keys(prev).length ? prev : next));
      }
      return;
    }
    const qParam = parseInt(search.get("qty") ?? "", 10);
    if (!Number.isFinite(qParam) || qParam <= 0) {
      initSelRef.current = true;
      return;
    }
    // ?tt = id exacto del tipo de entrada (una card por entrada en el detalle).
    // Fallback: la primera entrada del evento.
    const ttParam = search.get("tt");
    const target = ttParam
      ? data.ticketTypes.find((tt) => tt.id === ttParam)
      : data.ticketTypes[0];
    if (target) {
      initSelRef.current = true;
      setQty((prev) => (Object.keys(prev).length ? prev : { [target.id]: qParam }));
    }
  }, [data, search]);

  const items = useMemo(
    () =>
      Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([ticketTypeId, q]) => ({ ticketTypeId, qty: q })),
    [qty],
  );
  // Subtotal "todo incluido" del comprador: suma los `buyerPriceCents` que YA
  // vienen calculados del backend (comisión horneada cuando aplica) × promos
  // 2x1/3x2. El cliente NO recalcula la comisión — solo suma precios que le dio
  // el backend (regla en AGENTS.md). El total autoritativo llega en el quote.
  const promoResult = useMemo(() => {
    if (!data) return { totalCents: 0, lines: [] };
    const lineItems = data.ticketTypes
      .filter((tt) => (qty[tt.id] ?? 0) > 0)
      .map((tt) => ({
        ticketTypeId: tt.id,
        qty: qty[tt.id] ?? 0,
        unitPriceCents: tt.buyerPriceCents,
      }));
    return applyPromos(lineItems, data.promos ?? []);
  }, [data, qty]);
  const buyerSubtotal = promoResult.totalCents;
  const totalItems = items.reduce((a, b) => a + b.qty, 0);

  // Si el carrito cambia después de cotizar, la cotización vieja ya no aplica:
  // volvemos a la suma local (de precios del backend) hasta el próximo quote.
  const cartSig = useMemo(() => JSON.stringify(items), [items]);
  const serverQuote = quoted && quoted.sig === cartSig ? quoted.quote : null;

  // Números que se MUESTRAN. La línea "Servicio" aparte solo existe cuando el
  // backend lo indica (entradas >= S/15 con comisión aparte); en entradas
  // baratas la comisión va horneada en `buyerPriceCents`, sin línea.
  const displayShowFee = serverQuote?.showFeeLine ?? false;
  const displayFee = displayShowFee ? (serverQuote?.serviceFeeCents ?? 0) : 0;
  // Total: el autoritativo del quote si ya llegó; si no, la suma local de
  // `buyerPriceCents` (exacta cuando la comisión va horneada).
  const displayTotal = serverQuote?.totalCents ?? buyerSubtotal + displayFee;

  // Pide la cotización autoritativa y detecta drift (si la suma local de
  // `buyerPriceCents` difiere del total del server, algo quedó desincronizado).
  const requestQuote = () => {
    if (!data || items.length === 0) return;
    quote.mutate(
      { eventId: data.event.id, items: items.map((i) => ({ ticketTypeId: i.ticketTypeId, qty: i.qty })) },
      {
        onSuccess: (q) => {
          setQuoted({ sig: cartSig, quote: q });
          if (q.totalCents !== buyerSubtotal) {
            console.warn("[checkout] drift suma local vs total del server", {
              localTotal: buyerSubtotal,
              serverTotal: q.totalCents,
            });
          }
        },
        // Error de red/rate-limit: seguimos con la suma local (el backend
        // igual recalcula y cobra lo suyo al crear la orden).
        onError: () => {},
      },
    );
  };

  // Vence la reserva localmente cuando se cumplen los 30 min (el backend ya la
  // expira en paralelo). Solo corre durante la fase de pago.
  useEffect(() => {
    if (phase !== "pay" || reservedAt == null || reservationExpired) return;
    const check = () => {
      if (Date.now() >= reservedAt + RESERVATION_MS) setReservationExpired(true);
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [phase, reservedAt, reservationExpired]);

  const isLogged = !!me.data?.user;
  // Pedido gratis: hay entradas pero el total es 0 → no hay pago. El flujo es de
  // 2 pasos (pedido → datos) y se omite todo el lenguaje/paso de checkout.
  const isFreeOrder = buyerSubtotal === 0 && totalItems > 0;
  const emailOk = /.+@.+\..+/.test(guestEmail.trim());
  // guestPhone ya es E.164 (país + número) del PhoneField. Perú exige 9 dígitos
  // nacionales; extranjero, al menos 6 (longitudes varían por país).
  const phoneNational = parseE164(guestPhone).national;
  const phoneIsPeru = (parseE164(guestPhone).country?.code ?? "PE") === "PE";
  const phoneOk = phoneIsPeru ? phoneNational.length === 9 : phoneNational.length >= 6;
  // El portero valida por documento. Regla compartida con el backend: peruano =
  // 8 dígitos (con RENIEC); extranjero = pasaporte/documento alfanumérico, sin RENIEC.
  const docValid = isValidDocument(guestDni, isForeigner);
  const guestValid = guestName.trim().length >= 2 && docValid && phoneOk;
  const orderValid = totalItems > 0 && guestValid;

  if (!data) return <PageLoader />;

  const startPayment = async () => {
    try {
      const attendee = {
        email: guestEmail.trim() || null,
        fullName: guestName.trim(),
        dni: guestDni.trim(),
        // E.164 con país (fuente de verdad del contacto y del origen de la venta).
        phone: guestPhone || null,
        // El backend valida el documento según esto (8 díg peruano vs laxo extranjero).
        isForeigner,
      };
      const res = await buy.mutateAsync({
        eventId: data.event.id,
        items,
        promoCode,
        // Logueado → buyer (persiste en su perfil/kyc); guest → crea/reusa perfil.
        guest: isLogged ? undefined : attendee,
        buyer: isLogged ? attendee : undefined,
      });
      setPreferenceId(res.preference.id);
      setOrderId(res.order.id);
      // La orden creada es LA verdad final: sus montos pisan cualquier
      // precálculo (local o quote previo) para la fase de pago.
      if (res.order.totalCents !== buyerSubtotal) {
        console.warn("[checkout] drift suma local vs orden creada", {
          localTotal: buyerSubtotal,
          orderTotal: res.order.totalCents,
        });
      }
      // El desglose cara-al-comprador (subtotal / lo que se le carga / si se
      // muestra) es el del quote previo — es la verdad del backend. `res.order`
      // solo aporta el total FINAL y su `serviceFeeCents` es la COMISIÓN de
      // Pasape (incluye lo que absorbe el organizador), no lo cobrado al
      // comprador, así que no se usa para el desglose. Solo se fija el total.
      setQuoted((prev) =>
        prev?.sig === cartSig
          ? { sig: cartSig, quote: { ...prev.quote, totalCents: res.order.totalCents } }
          : {
              sig: cartSig,
              quote: {
                lines: [],
                subtotalCents: res.order.totalCents,
                serviceFeeCents: 0,
                totalCents: res.order.totalCents,
                showFeeLine: false,
                currency: res.order.currency,
              },
            },
      );

      // Órdenes gratuitas: la orden ya está pagada en el server.
      // Saltar PayPhase e ir directo a processing con total=0.
      if (buyerSubtotal === 0) {
        const emailQs = !isLogged && guestEmail.trim()
          ? `&email=${encodeURIComponent(guestEmail.trim())}`
          : "";
        router.push(`/events/${slug}/processing?order=${res.order.id}&total=0&n=${totalItems}${emailQs}`);
        return;
      }

      setReservedAt(Date.now());
      setReservationExpired(false);
      setPhase("pay");
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("order", res.order.id);
        window.history.replaceState({}, "", url.toString());
        sessionStorage.setItem(
          `pasape:buy:${res.order.id}`,
          JSON.stringify({
            qty,
            payMethod,
            guestEmail: guestEmail.trim(),
            guestName: guestName.trim(),
            guestDni: guestDni.trim(),
            guestPhone, // E.164; el PhoneField lo re-parsea al restaurar.
          }),
        );
      } catch {}
    } catch (e) {
      // Pedido gratis: nunca se intentó cobrar nada (falló crear la orden/los
      // tickets en sí) — el copy de "no pudimos cobrarte" del reason default
      // es incorrecto y confunde. `buy_failed` tiene copy neutral.
      const reason = encodeURIComponent(
        buyerSubtotal === 0 ? "buy_failed" : (e as Error).message || "unknown",
      );
      router.replace(`/events/${slug}/pay-error?reason=${reason}`);
    }
  };

  const pickValid = totalItems > 0;
  const dataValid = guestValid;

  const onPrimary = () => {
    if (phase === "pick" && pickValid) {
      // No bloquea el paso: la cotización llega en paralelo y pisa los números
      // locales al aterrizar.
      requestQuote();
      setPhase("data");
      return;
    }
    if (phase === "data" && orderValid) void startPayment();
  };

  const onBack = () => {
    if (phase === "pay") {
      setPhase("data");
      return;
    }
    if (phase === "data") {
      setPhase("pick");
      return;
    }
    router.back();
  };

  // Reintentar tras vencer: el stock se liberó, así que volvemos a armar el
  // pedido desde el inicio (la orden vieja quedó expirada en el backend).
  const retryReservation = () => {
    setReservationExpired(false);
    setReservedAt(null);
    setOrderId(null);
    setPreferenceId(null);
    setPhase("pick");
  };

  // Stepper honesto: gratis = 2 pasos (sin "Pago"); pagado = 3.
  const phaseLabel: Record<Phase, string> = isFreeOrder
    ? {
        pick: "1 de 2 · Tu pedido",
        data: "2 de 2 · Tus datos",
        pay: "2 de 2 · Tus datos",
      }
    : {
        pick: "1 de 3 · Tu pedido",
        data: "2 de 3 · Tus datos",
        pay: "3 de 3 · Pago",
      };

  const primaryCtaLabel = (compact: boolean): string => {
    if (buy.isPending) return "Preparando…";
    if (phase === "pick") {
      if (!pickValid) return "Elige una entrada";
      if (isFreeOrder) return "Continuar · Gratis";
      return `Continuar · ${formatPrice(displayTotal)}`;
    }
    if (phase === "data") {
      if (!dataValid) return "Completa tus datos";
      if (buyerSubtotal === 0) return "Confirmar entrada gratuita";
      return `Ir a pagar · ${formatMoney(displayTotal)}`;
    }
    return "Continuar";
  };
  const primaryCtaDisabled = (() => {
    if (buy.isPending) return true;
    if (phase === "pick") return !pickValid;
    if (phase === "data") return !orderValid;
    return false;
  })();

  return (
    <div className="min-h-dvh bg-cart-bg text-white">
      {/* Header de usuario reutilizado */}
      <UserHeader />

      {/* Fila contextual del checkout: volver + paso actual */}
      <div className="mx-auto w-full max-w-[1120px] px-5 lg:px-8">
        <div className="flex items-center gap-3 py-3.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[12.5px] font-medium text-cart-ink-3">{phaseLabel[phase]}</span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1120px] px-5 lg:flex lg:items-start lg:px-8 lg:pb-10">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
          {/* Main */}
          <main className="pt-6 lg:pb-12">
            {phase === "pick" ? (
              <PickPhase ticketTypes={data.ticketTypes} qty={qty} setQty={setQty} />
            ) : phase === "data" ? (
              <DataPhase
                isLogged={isLogged}
                userIdent={me.data?.user?.email ?? me.data?.user?.phone ?? null}
                isForeigner={isForeigner}
                setIsForeigner={setIsForeigner}
                guestDni={guestDni}
                setGuestDni={(v) => {
                  nameTouchedRef.current = false;
                  // Extranjero: alfanumérico (pasaporte). Peruano: solo 8 dígitos.
                  setGuestDni(
                    isForeigner
                      ? v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15)
                      : v.replace(/\D/g, "").slice(0, 8),
                  );
                }}
                guestName={guestName}
                setGuestName={(v) => {
                  nameTouchedRef.current = true;
                  setGuestName(v);
                }}
                guestPhone={guestPhone}
                setGuestPhone={setGuestPhone}
                guestEmail={guestEmail}
                setGuestEmail={setGuestEmail}
                dniHint={dniHint}
                dniPending={dniPending}
              />
            ) : (
              <>
                {reservedAt != null && !reservationExpired && (
                  <ReservationCountdown reservedAt={reservedAt} />
                )}
                <PayPhase
                  payMethod={payMethod}
                  setPayMethod={setPayMethod}
                  orderId={orderId}
                onExpired={() => setReservationExpired(true)}
                totalCents={displayTotal}
                isLogged={isLogged}
                userPhone={me.data?.user?.phone ?? ""}
                userName={me.data?.user?.fullName ?? ""}
                userEmail={me.data?.user?.email ?? ""}
                guestName={guestName}
                guestPhone={guestPhone}
                guestEmail={guestEmail}
                setGuestEmail={setGuestEmail}
                guestDni={guestDni}
                emailOk={emailOk}
                onPaid={() => {
                  if (!orderId) return;
                  try {
                    sessionStorage.removeItem(`pasape:buy:${orderId}`);
                  } catch {}
                  // Why: el polling de /processing necesita el email del guest
                  // para autorizar el lookup del status (sin sesión). Sin esto
                  // todos los polls dan 403 y termina en pay-error a los 60s.
                  const emailQs = !isLogged && guestEmail.trim()
                    ? `&email=${encodeURIComponent(guestEmail.trim())}`
                    : "";
                  router.push(`/events/${slug}/processing?order=${orderId}&total=${displayTotal}&method=${payMethod}&n=${totalItems}${emailQs}`);
                }}
                />
              </>
            )}
            {/* Sentinel = final real del contenido. El espacio para el CTA va
                debajo, así no infla la detección de "hay más abajo". */}
            <div ref={contentEndRef} aria-hidden className="h-px w-full" />
            <div aria-hidden className="h-40 lg:hidden" />
          </main>

          {/* Sidebar summary (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <OrderSummary
                event={data.event}
                ticketTypes={data.ticketTypes}
                qty={qty}
                total={displayTotal}
                fee={displayFee}
                showFee={displayShowFee}
                promo={promoCode}
              />
              {phase !== "pay" && (
                <button
                  type="button"
                  onClick={onPrimary}
                  disabled={primaryCtaDisabled}
                  className="mt-4 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
                >
                  {primaryCtaLabel(false)}
                </button>
              )}
              {buy.error && (
                <p className="mt-3 text-center text-[12px] text-rose-300">
                  {buyErrorMsg((buy.error as Error).message)}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      {phase !== "pay" && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-cart-line bg-cart-bg/95 backdrop-blur-md lg:hidden"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          {/* Pista "hay más abajo": el contenido se difumina hacia el CTA y un
              chevron rebota, hasta que se llega al final del scroll. */}
          <AnimatePresence>
            {moreBelow && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-x-0 -top-14 h-14 bg-gradient-to-t from-cart-bg via-cart-bg/85 to-transparent"
              >
                <div className="flex h-full items-end justify-center pb-1.5">
                  <motion.span
                    animate={{ y: [0, 4, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    className="grid size-7 place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-accent shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mx-auto w-full max-w-[640px] px-5 pt-3">
            {buy.error && (
              <p className="mb-2 text-center text-[12px] text-rose-300">
                {buyErrorMsg((buy.error as Error).message)}
              </p>
            )}
            <button
              type="button"
              onClick={onPrimary}
              disabled={primaryCtaDisabled}
              className="w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition active:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
            >
              {primaryCtaLabel(true)}
            </button>
          </div>
        </div>
      )}

      {/* Popover de reserva vencida */}
      {reservationExpired && (
        <ReservationExpiredModal
          onRetry={retryReservation}
          onCancel={() => router.push(`/events/${slug}` as never)}
        />
      )}
    </div>
  );
}

/* ====================== Reserva: countdown + modal ====================== */

function ReservationCountdown({ reservedAt }: { reservedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const msLeft = Math.max(0, reservedAt + RESERVATION_MS - now);
  const mins = Math.floor(msLeft / 60000);
  const secs = Math.floor((msLeft % 60000) / 1000);
  const low = msLeft <= 2 * 60000; // últimos 2 min en rojo
  return (
    <div
      className={
        "mb-4 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium " +
        (low
          ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
          : "border-cart-line bg-cart-bg-elev text-cart-ink-2")
      }
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 6v3l2 1.5M6 1.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span>
        Reservamos tus entradas ·{" "}
        <span className="tabular-nums font-semibold">
          {mins}:{secs.toString().padStart(2, "0")}
        </span>
      </span>
    </div>
  );
}

function ReservationExpiredModal({
  onRetry,
  onCancel,
}: {
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-6 backdrop-blur-sm">
      <div className="w-full max-w-[380px] rounded-2xl border border-cart-line bg-cart-bg-elev p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-rose-500/15 text-rose-300">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 6v3l2 1.5M6 1.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-white">
          Venció tu tiempo
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-cart-ink-2">
          Tu reserva de 30 minutos terminó y liberamos las entradas. Puedes
          volver a armar tu pedido si todavía hay disponibilidad.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 w-full rounded-full bg-cart-accent py-3 text-[14.5px] font-semibold text-cart-bg transition hover:brightness-110"
        >
          Volver a empezar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full rounded-full py-2.5 text-[13.5px] font-medium text-cart-ink-3 transition hover:text-white"
        >
          Salir
        </button>
      </div>
    </div>
  );
}

/* ============================ Order phase ============================ */

function PickPhase({
  ticketTypes,
  qty,
  setQty,
}: {
  ticketTypes: TicketType[];
  qty: Record<string, number>;
  setQty: (next: Record<string, number>) => void;
}) {
  // Entradas normales: cada tipo su card (su nombre las diferencia). Boxes
  // ("espacios"): agrupados por unit_noun en una grilla. Sin tabs de zona.
  const groups = useMemo<TicketGroup[]>(() => {
    const out: TicketGroup[] = [];
    const boxes: TicketType[] = [];
    for (const tt of ticketTypes) {
      if (tt.kind === "box") boxes.push(tt);
      else out.push({ label: null, items: [tt] });
    }
    for (const g of groupBoxesByNoun(boxes)) out.push(g);
    return out;
  }, [ticketTypes]);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Entradas">
        <div className="flex flex-col gap-5">
          {groups.map((group, gi) => {
            const allBoxes =
              group.items.length > 0 && group.items.every((i) => i.kind === "box");
            // Grilla de tiles para espacios (boxes) con 4+ — evita repetir cards
            // idénticas que solo cambian de número.
            const useGrid = allBoxes && group.items.length >= 4;
            return (
              <div key={group.label ?? `tt-${gi}`} className="flex flex-col gap-2.5">
                {useGrid ? (
                  <BoxGrid
                    items={group.items}
                    qty={qty}
                    onChange={(id, v) => setQty({ ...qty, [id]: v })}
                  />
                ) : (
                  group.items.map((tt) => (
                    <TicketCard
                      key={tt.id}
                      tt={tt}
                      value={qty[tt.id] ?? 0}
                      onChange={(v) => setQty({ ...qty, [tt.id]: v })}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Preview de reparto: SOLO entradas individuales. Un box no se "reparte"
          aquí — se invita por link desde su panel después de pagar, así que ni
          dispara este aviso ni se cuenta en él. */}
      {(() => {
        const individualUnits = ticketTypes.reduce(
          (a, tt) => a + (tt.kind === "box" ? 0 : (qty[tt.id] ?? 0)),
          0,
        );
        return individualUnits >= 2 ? <SeatHandoffPreview units={individualUnits} /> : null;
      })()}
    </div>
  );
}

/**
 * Vista previa del reparto en el checkout: muestra "caritas" (tú + una por cada
 * acompañante) para que el comprador entienda, sin leer, que cada entrada tiene
 * un dueño. NO es interactivo aquí: la asignación real se hace al terminar de
 * pagar (checkout liviano). Si tocan algo, un toast lo aclara.
 */
function SeatHandoffPreview({ units }: { units: number }) {
  const [toast, setToast] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = () => {
    setToast(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(false), 2400);
  };

  // Cap visual para que la fila no explote con cantidades altas.
  const others = units - 1;
  const shown = Math.min(others, 6);
  const overflow = others - shown;

  return (
    <>
      <button
        type="button"
        onClick={poke}
        className="w-full cursor-default rounded-2xl border border-cart-line bg-cart-bg-elev p-4 text-left"
      >
        <div className="flex items-center justify-center gap-2 text-[13.5px] font-semibold">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="text-cart-ink-2" aria-hidden>
            <path d="M3 9a2 2 0 002-2V6h14v1a2 2 0 000 4v1a2 2 0 000 4v1H5v-1a2 2 0 00-2-2 2 2 0 010-4z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 6v12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Compraste {units} entradas
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-center gap-x-4 gap-y-3">
          <Avatar kind="me" label="Tú" />
          {Array.from({ length: shown }).map((_, i) => (
            <Avatar key={i} kind="add" label="Persona" />
          ))}
          {overflow > 0 && <Avatar kind="more" label="" count={overflow} />}
        </div>

        <p className="mt-4 border-t border-cart-line pt-3 text-center text-[12px] text-cart-ink-2">
          A cada una le pones sus datos o se la envías
          <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-cart-accent-soft px-2 py-0.5 text-[11px] font-semibold text-cart-accent">
            al pagar
          </span>
        </p>
      </button>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed inset-x-0 bottom-[96px] z-50 flex justify-center px-5"
          >
            <span className="rounded-full bg-white/95 px-4 py-2.5 text-[13px] font-medium text-gray-900 shadow-lg backdrop-blur-sm">
              Lo podrás seleccionar al finalizar el pago
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Avatar({
  kind,
  label,
  count,
}: {
  kind: "me" | "add" | "more";
  label: string;
  count?: number;
}) {
  return (
    <div className="text-center">
      {kind === "me" ? (
        <div
          className="mx-auto grid size-12 place-items-center rounded-full text-[16px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, #FF4D5E, #7C3AED 60%, #4B1F9A)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 20v-1a6 6 0 016-6h4a6 6 0 016 6v1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ) : kind === "more" ? (
        <div className="mx-auto grid size-12 place-items-center rounded-full border-2 border-dashed border-cart-line-strong text-[14px] font-bold text-cart-ink-2">
          +{count}
        </div>
      ) : (
        <div className="mx-auto grid size-12 place-items-center rounded-full border-2 border-dashed border-cart-line-strong text-cart-ink-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      {label && <div className="mt-1.5 text-[11.5px] text-cart-ink-2">{label}</div>}
    </div>
  );
}

function DataPhase({
  isLogged,
  userIdent,
  isForeigner,
  setIsForeigner,
  guestDni,
  setGuestDni,
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  guestEmail,
  setGuestEmail,
  dniHint,
  dniPending,
}: {
  isLogged: boolean;
  userIdent: string | null;
  isForeigner: boolean;
  setIsForeigner: (v: boolean) => void;
  guestDni: string;
  setGuestDni: (v: string) => void;
  guestName: string;
  setGuestName: (v: string) => void;
  guestPhone: string;
  setGuestPhone: (v: string) => void;
  guestEmail: string;
  setGuestEmail: (v: string) => void;
  dniHint: "idle" | "not_found";
  dniPending: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <Section
        title={isLogged ? "Tus datos" : "¿Quién va?"}
        hint={
          isLogged
            ? "De tu cuenta — edítalos si algo cambió"
            : "Para enviarte el QR por WhatsApp"
        }
      >
        <div className="flex flex-col gap-3">
          {isLogged && userIdent && (
            <div className="flex items-center gap-2 rounded-xl bg-cart-accent-soft px-3.5 py-2.5 text-[12px] text-cart-accent ring-1 ring-cart-accent/30">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="truncate">
                Conectado como <span className="font-semibold">{userIdent}</span>
              </span>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-cart-ink-2">
            <input
              type="checkbox"
              checked={isForeigner}
              onChange={(e) => setIsForeigner(e.target.checked)}
              className="h-4 w-4 accent-cart-accent"
            />
            Soy extranjero (no tengo DNI)
          </label>
          <Field
            label={isForeigner ? "Pasaporte / documento" : "DNI"}
            value={guestDni}
            onChange={setGuestDni}
            placeholder={isForeigner ? "AB123456" : "71234567"}
            mono
            hint={
              isForeigner
                ? "Con lo que te identificas en la puerta. Escribe tu nombre abajo."
                : dniHint === "not_found"
                  ? "No te encontramos en RENIEC — escribe tu nombre abajo."
                  : isLogged && guestDni
                    ? "Lo usa el portero para validar tu entrada."
                    : "Lo buscamos en RENIEC y completamos tu nombre."
            }
          />
          <Field
            label="Nombre completo"
            value={guestName}
            onChange={setGuestName}
            placeholder={dniPending ? "Buscando en RENIEC…" : "Juan Pérez García"}
            disabled={dniPending}
          />
          <label className="block">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
              WhatsApp
            </span>
            <div className="mt-1.5">
              {/* Selector de país (default Perú): el comprador puede ser
                  extranjero aunque el evento sea en Perú. Guarda E.164. */}
              <PhoneField value={guestPhone} onChange={setGuestPhone} />
            </div>
            <span className="mt-1.5 block text-[11.5px] text-cart-ink-4">
              Tu QR llega por aquí.
            </span>
          </label>
          <Field
            label="Email (opcional)"
            type="email"
            value={guestEmail}
            onChange={setGuestEmail}
            placeholder="juan@gmail.com"
            hint="Solo si pagas con tarjeta."
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold tracking-[-0.01em]">{title}</h2>
        {hint && <span className="text-[11.5px] text-cart-ink-3">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function TicketBadge({
  kind,
  boxLabel,
}: {
  kind: TicketType["kind"];
  boxLabel: string | null;
}) {
  if (kind === "box")
    return (
      <span className="rounded-full bg-cart-accent-soft px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.1em] text-cart-accent">
        Box{boxLabel ? ` · ${boxLabel}` : ""}
      </span>
    );
  // VIP/General ya no son tipos: el nombre de la entrada los distingue.
  return null;
}

/** Escasez por umbral porcentual: solo "enciende" cuando queda ≤30% del stock. */
function lowStock(sold: number, capacity: number) {
  const remaining = Math.max(0, capacity - sold);
  const pct = capacity > 0 ? remaining / capacity : 0;
  return { remaining, pct, low: capacity > 0 && remaining > 0 && pct <= 0.3 };
}

/**
 * Línea de FOMO de disponibilidad. Con `noun` (boxes/mesas) muestra la cuenta
 * exacta ("Solo quedan 3 boxes"); sin él, el porcentaje ("Solo queda 22%").
 */
function ScarcityNote({
  remaining,
  pct,
  noun,
}: {
  remaining: number;
  pct: number;
  noun?: string;
}) {
  const label = noun
    ? `Solo ${remaining === 1 ? "queda" : "quedan"} ${remaining} ${
        remaining === 1 ? noun : unitNounPlural(noun)
      }`
    : `Solo queda ${Math.round(pct * 100)}% disponible`;
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-rose-300">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
      </span>
      {label}
    </div>
  );
}

function BoxGrid({
  items,
  qty,
  onChange,
}: {
  items: TicketType[];
  qty: Record<string, number>;
  onChange: (ticketTypeId: string, value: number) => void;
}) {
  const selectedItems = items.filter((tt) => (qty[tt.id] ?? 0) > 0);
  // Precio "todo incluido" del backend (comisión ya horneada cuando aplica).
  const totalCents = selectedItems.reduce((acc, tt) => acc + tt.buyerPriceCents, 0);
  const totalPeople = selectedItems.reduce((acc, tt) => acc + boxSeats(tt), 0);

  // Si todos los espacios tienen el mismo precio y capacidad, se muestra una
  // sola vez arriba del grid. Es el caso típico.
  const uniqPrices = new Set(items.map((i) => i.buyerPriceCents));
  const uniqCaps = new Set(items.map((i) => boxSeats(i)));
  const samePrice = uniqPrices.size === 1;
  const sameCap = uniqCaps.size === 1;
  const commonPriceCents = samePrice ? items[0].buyerPriceCents : null;
  const commonCap = sameCap ? boxSeats(items[0]) : null;
  const currency = items[0].currency;
  // Noun más usado en el grupo (los items suelen compartirlo). Default "box".
  const noun = unitNoun(items[0]);
  // Espacios libres del grupo (cada box/mesa es una unidad reservable).
  const freeCount = items.filter((tt) => ticketStatus(tt).kind !== "soldout").length;

  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-4">
      {/* Título de la tarjeta de espacios */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[15.5px] font-semibold tracking-[-0.01em]">
          {capitalize(unitNounPlural(noun))}
        </span>
      </div>
      {/* Header común — info que se repetía en cada card */}
      <div className="flex items-baseline justify-between">
        <p className="text-[12.5px] text-cart-ink-2">
          {commonCap !== null
            ? `Cada ${noun} para ${commonCap} personas · Tú invitas`
            : "Tú invitas a tu grupo"}
        </p>
        {commonPriceCents !== null && (
          <p className="text-[14px] font-bold tracking-[-0.01em] text-white">
            <Price cents={commonPriceCents} currency={currency} />
            {commonPriceCents > 0 && (
              <span className="ml-0.5 text-[10.5px] font-medium text-cart-ink-3">/{noun}</span>
            )}
          </p>
        )}
      </div>

      {/* Escasez por unidad: solo enciende cuando quedan ≤30% de los espacios */}
      {freeCount > 0 && freeCount / items.length <= 0.3 ? (
        <ScarcityNote remaining={freeCount} pct={freeCount / items.length} noun={noun} />
      ) : null}

      {/* Grid de tiles */}
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2">
        {items.map((tt) => {
          const status = ticketStatus(tt);
          const sold = status.kind === "soldout";
          const selected = (qty[tt.id] ?? 0) > 0;
          // Si el precio difiere, mostrar el precio en la tile como subline
          const showPriceOnTile = !samePrice;
          return (
            <button
              key={tt.id}
              type="button"
              disabled={sold}
              onClick={() => onChange(tt.id, selected ? 0 : 1)}
              aria-pressed={selected}
              title={`${tt.boxLabel ?? tt.name}${sold ? " · Reservado" : ""}`}
              className={
                "group relative grid aspect-square place-items-center rounded-xl text-center font-semibold transition " +
                (sold
                  ? "cursor-not-allowed border border-cart-line bg-cart-bg-elev-2/40 text-cart-ink-4"
                  : selected
                    ? "bg-cart-accent text-cart-bg shadow-[0_6px_20px_-6px_var(--color-cart-accent-glow)]"
                    : "border border-cart-line bg-cart-bg-elev-2 text-white hover:border-cart-accent hover:text-cart-accent")
              }
            >
              <span className={"leading-none " + (showPriceOnTile ? "text-[13px]" : "text-[15px]")}>
                {tileLabel(tt)}
              </span>
              {showPriceOnTile && !sold && (
                <Price cents={tt.buyerPriceCents} currency={tt.currency} className="mt-0.5 block text-[9.5px] font-medium opacity-80" />
              )}
              {sold && (
                <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 -rotate-45 bg-cart-ink-4/60" />
              )}
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-cart-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-cart-line bg-cart-bg-elev-2" />
          Libre
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-cart-accent" />
          Tu elección
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-cart-line bg-cart-bg-elev-2/40" />
          Reservado
        </span>
      </div>

      {/* Resumen de selección */}
      <div className="mt-4 border-t border-cart-line pt-3">
        {selectedItems.length === 0 ? (
          <p className="text-center text-[12.5px] text-cart-ink-3">
            Tappea {indefiniteArticle(noun)} {noun} para reservarlo
          </p>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-white">
                {selectedItems.map((s) => s.boxLabel ?? s.name).join(" · ")}
              </p>
              <p className="mt-0.5 text-[11.5px] text-cart-ink-3">
                {selectedItems.length === 1
                  ? `${boxSeats(selectedItems[0])} personas`
                  : `${selectedItems.length} ${unitNounPlural(noun)} · ${totalPeople} personas`}
              </p>
            </div>
            <p className="shrink-0 text-[15px] font-bold tracking-[-0.01em]">
              {formatMoney(totalCents, currency)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Artículo indefinido aproximado en castellano según terminación del noun. */
function indefiniteArticle(noun: string): string {
  return noun.toLowerCase().endsWith("a") ? "una" : "un";
}

function tileLabel(tt: TicketType): string {
  // Extrae el "número" o label corto del box ("Box 7" → "7", "S.VIP 1" → "S1", "M3" → "M3").
  const raw = (tt.boxLabel ?? tt.name).trim();
  // Si empieza con "Box " quita el prefijo
  const stripped = raw.replace(/^Box\s+/i, "");
  // Comprime "S.VIP 1" → "S1" para que entre
  if (stripped.length > 4) {
    const m = stripped.match(/([A-Z])\.?[A-Z]*\.?\s*(\d+)/i);
    if (m) return `${m[1].toUpperCase()}${m[2]}`;
  }
  return stripped;
}

function TicketCard({
  tt,
  value,
  onChange,
}: {
  tt: TicketType;
  value: number;
  onChange: (v: number) => void;
}) {
  const status = ticketStatus(tt);
  const soldOut = status.kind === "soldout";
  const expired = status.kind === "expired";
  const unavailable = soldOut || expired;
  const isBox = tt.kind === "box";
  const remaining = status.kind === "available" ? status.remaining : 0;
  const selected = value > 0;
  const ap = activePricing(tt);
  // Solo aplica a entradas (no box); stockTotal() resuelve el cupo correcto.
  const stock = lowStock(tt.sold, stockTotal(tt));

  const saleDeadline =
    tt.saleEndsAt && status.kind !== "expired"
      ? new Date(tt.saleEndsAt).toLocaleDateString("es-PE", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div
      className={
        "rounded-2xl border bg-cart-bg-elev px-4 py-4 transition " +
        (unavailable
          ? "border-cart-line opacity-60"
          : selected
            ? "border-cart-accent shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
            : "border-cart-line hover:border-cart-line-strong")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15.5px] font-semibold tracking-[-0.01em]">
              {tt.name}
            </span>
            <TicketBadge kind={tt.kind} boxLabel={tt.boxLabel} />
            {ap.isFree ? (
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-300">
                Gratis
              </span>
            ) : ap.isPresale && (
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-emerald-300">
                Preventa
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-cart-ink-3">
            {ticketSubtitle(tt)}
            {(ap.isPresale || ap.isFree) && ap.basePriceCents > 0 && (
              <span className="text-cart-ink-4"> · luego {formatMoney(ap.basePriceCents, tt.currency)}</span>
            )}
          </div>
          {ap.isFree && ap.freeUntilAt && shouldCountdown(ap.freeUntilAt) ? (
            <div className="mt-1">
              <PresaleCountdown endsAt={ap.freeUntilAt} />
            </div>
          ) : ap.isPresale && ap.presaleEndsAt && shouldCountdown(ap.presaleEndsAt) ? (
            <div className="mt-1">
              <PresaleCountdown endsAt={ap.presaleEndsAt} />
            </div>
          ) : saleDeadline ? (
            <div className="mt-1 text-[11px] text-amber-400/80">Válida hasta el {saleDeadline}</div>
          ) : null}
          {/* Escasez: solo entradas no-box; los boxes muestran su escasez en BoxGrid */}
          {!isBox && stock.low ? (
            <ScarcityNote remaining={stock.remaining} pct={stock.pct} />
          ) : null}
        </div>
        <div className="text-right">
          {(ap.isPresale || ap.isFree) && ap.basePriceCents > 0 && (
            <div className="text-[12px] font-medium text-cart-ink-4 line-through">
              {formatMoney(ap.basePriceCents, tt.currency)}
            </div>
          )}
          <Price cents={tt.buyerPriceCents} currency={tt.currency} className="block text-[16px] font-bold tracking-[-0.01em]" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.1em] text-cart-ink-4">
          {isBox ? "Reserva" : "Cantidad"}
        </span>
        {isBox ? (
          <BoxToggle
            noun={unitNoun(tt)}
            selected={selected}
            disabled={unavailable}
            onChange={(v) => onChange(v ? 1 : 0)}
          />
        ) : (
          <QtyControl
            value={value}
            max={remaining}
            onChange={onChange}
            disabled={unavailable}
          />
        )}
      </div>
    </div>
  );
}

function BoxToggle({
  noun,
  selected,
  disabled,
  onChange,
}: {
  noun: string;
  selected: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  if (disabled) {
    return (
      <span className="rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[11.5px] font-medium uppercase tracking-[0.1em] text-cart-ink-3">
        Reservado
      </span>
    );
  }
  if (!selected) {
    return (
      <button
        type="button"
        onClick={() => onChange(true)}
        className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-cart-bg transition hover:brightness-95"
      >
        Reservar {noun}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onChange(false)}
      className="inline-flex items-center gap-2 rounded-full bg-cart-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-cart-bg transition hover:brightness-110"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 6.5l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Reservado por ti
    </button>
  );
}

function QtyControl({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span className="rounded-full bg-cart-bg-elev-2 px-3 py-1.5 text-[11.5px] font-medium uppercase tracking-[0.1em] text-cart-ink-3">
        Agotado
      </span>
    );
  }
  if (value === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-cart-bg transition hover:brightness-95"
      >
        Agregar
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-full border border-cart-line-strong bg-cart-bg-elev-2 px-1.5 py-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label="Restar"
        className="grid size-7 place-items-center rounded-full bg-cart-bg text-white transition hover:bg-cart-accent hover:text-cart-bg"
      >
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      <span className="min-w-5 text-center text-[14px] font-bold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Sumar"
        disabled={value >= max}
        className="grid size-7 place-items-center rounded-full bg-cart-bg text-white transition hover:bg-cart-accent hover:text-cart-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono,
  type,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
        {label}
      </span>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={
          "mt-1.5 block w-full rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 text-[15px] text-white outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60 " +
          (mono ? "font-mono tracking-[0.04em]" : "")
        }
      />
      {hint && (
        <span className="mt-1.5 block text-[11.5px] text-cart-ink-4">{hint}</span>
      )}
    </label>
  );
}

/* ============================ Pay phase ============================ */

function PayPhase({
  payMethod,
  setPayMethod,
  orderId,
  totalCents,
  isLogged,
  userPhone,
  userName,
  userEmail,
  guestName,
  guestPhone,
  guestEmail,
  setGuestEmail,
  guestDni,
  emailOk,
  onPaid,
  onExpired,
}: {
  payMethod: "yape" | "mp";
  setPayMethod: (m: "yape" | "mp") => void;
  orderId: string | null;
  totalCents: number;
  isLogged: boolean;
  userPhone: string;
  userName: string;
  userEmail: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  setGuestEmail: (v: string) => void;
  guestDni: string;
  emailOk: boolean;
  onPaid: () => void;
  onExpired: () => void;
}) {
  if (!orderId) {
    return <p className="py-8 text-center text-[13px] text-cart-ink-3">Preparando el checkout…</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {/* Mobile total summary (desktop ya lo muestra en sidebar) */}
      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 lg:hidden">
        <div className="flex items-baseline justify-between">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
            Total a pagar
          </span>
          <span className="text-[22px] font-bold tabular-nums tracking-[-0.02em]">
            {formatMoney(totalCents)}
          </span>
        </div>
      </div>

      {/* Yape — primary, full width, brand green */}
      <button
        type="button"
        onClick={() => setPayMethod("yape")}
        className={
          "flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition " +
          (payMethod === "yape"
            ? "border-[#41E0BC] bg-[#41E0BC]/10 shadow-[0_0_0_4px_rgba(65,224,188,0.16)]"
            : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong")
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/yape.png" alt="Yape" className="size-12 flex-shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[16.5px] font-semibold">Pagar con Yape</span>
            <span className="rounded-md bg-[#41E0BC] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#062315]">
              Más rápido
            </span>
          </div>
          <div className="mt-0.5 text-[12px] text-cart-ink-3">
            Listo en 10 segundos · sin tarjeta
          </div>
        </div>
        <Radio active={payMethod === "yape"} color="#41E0BC" />
      </button>

      {/* Tarjeta — secondary */}
      <button
        type="button"
        onClick={() => setPayMethod("mp")}
        className={
          "flex items-center gap-3 rounded-2xl border p-4 text-left transition " +
          (payMethod === "mp"
            ? "border-cart-accent bg-cart-accent-soft"
            : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong")
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mercadopago.svg" alt="Mercado Pago" className="size-12 flex-shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <div className="text-[16.5px] font-semibold">Pagar con tarjeta</div>
          <div className="mt-0.5 text-[12px] text-cart-ink-3">Tarjeta de crédito o débito · Visa / Mastercard</div>
        </div>
        <Radio active={payMethod === "mp"} color="var(--color-cart-accent)" />
      </button>

      {/* Form area */}
      <div className="mt-2">
        {payMethod === "yape" ? (
          <YapeForm
            orderId={orderId}
            amount={totalCents / 100}
            initialPhone={parseE164(isLogged ? userPhone : guestPhone).national}
            onPaid={onPaid}
            onError={(msg) => console.warn("yape error:", msg)}
          />
        ) : !isLogged && !emailOk ? (
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-5">
            <div className="text-[16px] font-semibold">Necesitamos tu email</div>
            <p className="mt-1 text-[13px] text-cart-ink-3">
              Mercado Pago lo pide para el comprobante de tarjeta.
            </p>
            <div className="mt-4">
              <Field
                label="Email"
                value={guestEmail}
                onChange={setGuestEmail}
                placeholder="juan@gmail.com"
                type="email"
              />
            </div>
          </div>
        ) : (
          <CardForm
            orderId={orderId}
            amount={totalCents / 100}
            initialHolder={isLogged ? userName : guestName}
            initialDni={isLogged ? "" : guestDni}
            initialEmail={isLogged ? userEmail : guestEmail}
            onPaid={onPaid}
            onError={(msg) => console.warn("card error:", msg)}
            onExpired={onExpired}
          />
        )}
      </div>

      <p className="mt-2 text-center text-[12px] text-cart-ink-4">
        Tu QR llega apenas confirmemos el pago.
      </p>
    </div>
  );
}

function Radio({ active, color }: { active: boolean; color: string }) {
  return (
    <span
      className="grid size-5 flex-shrink-0 place-items-center rounded-full border-2 transition"
      style={{
        borderColor: active ? color : "rgba(255,255,255,0.18)",
      }}
    >
      {active && <span className="size-2.5 rounded-full" style={{ background: color }} />}
    </span>
  );
}

/* ============================ Sidebar summary ============================ */

function OrderSummary({
  event,
  ticketTypes,
  qty,
  total,
  fee,
  showFee,
  promo,
}: {
  event: { title: string; coverUrl: string | null; startsAt: string; timezone: string };
  ticketTypes: TicketType[];
  qty: Record<string, number>;
  total: number;
  fee: number;
  showFee: boolean;
  promo: string | null;
}) {
  // Nombre real del promotor; el código queda como fallback mientras carga.
  const { data: promoterInfo } = usePromoterDisplayName(promo);
  const promoterLabel = promoterInfo?.name ?? promo;
  const lines = ticketTypes.filter((tt) => (qty[tt.id] ?? 0) > 0);
  const startsAt = new Date(event.startsAt);
  const dateLabel = new Intl.DateTimeFormat("es-PE", {
    timeZone: event.timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startsAt).replace(".", "");

  return (
    <div className="rounded-3xl border border-cart-line bg-cart-bg-elev p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-3">
        <div className="size-12 flex-shrink-0 overflow-hidden rounded-xl bg-cart-bg-elev-2">
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full" style={{ background: "linear-gradient(135deg, #4B1F9A, #FF4D5E)" }} />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-tight">
            {event.title}
          </div>
          <div className="mt-0.5 text-[11.5px] text-cart-ink-3">{dateLabel}</div>
        </div>
      </div>

      <div className="my-4 h-px bg-cart-line" />

      {lines.length === 0 ? (
        <p className="py-2 text-center text-[12.5px] text-cart-ink-3">
          Aún no eliges entradas
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {lines.map((tt) => (
            <div key={tt.id} className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-cart-ink-2">
                {tt.name} <span className="text-cart-ink-3">× {qty[tt.id]}</span>
              </span>
              <span className="text-[13px] font-semibold tabular-nums">
                <Price cents={tt.buyerPriceCents * (qty[tt.id] ?? 0)} currency={tt.currency} />
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="my-4 h-px bg-cart-line" />

      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-cart-ink-3">
          Total
        </span>
        <span className="text-[22px] font-bold tabular-nums tracking-[-0.02em]">
          <Price cents={total} />
        </span>
      </div>

      {/* Las líneas ya son precio "todo incluido" (buyerPriceCents): la comisión
          se aclara como nota, no como fila que parezca sumarse otra vez. */}
      {showFee && fee > 0 && (
        <p className="mt-1 text-right text-[11px] text-cart-ink-4">
          Incluye {formatMoney(fee)} de servicio
        </p>
      )}

      {promo && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-cart-accent/30 bg-cart-accent-soft px-3 py-2">
          <span className="grid size-5 place-items-center rounded-full bg-cart-accent/30 text-cart-accent">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M3 7l3 3 7-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="truncate text-[11.5px] text-cart-ink-2">
            Promotor: <span className="font-medium text-white">{promoterLabel}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function PageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-cart-bg text-cart-ink-3">
      <span className="text-[13px]">Cargando…</span>
    </div>
  );
}

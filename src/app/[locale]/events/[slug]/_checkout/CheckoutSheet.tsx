"use client";

// Bottom-sheet de checkout que sube SOBRE la página del evento (flyer difuminado
// detrás = identidad viva, no un formulario huérfano). Solo lleva el paso de
// DATOS ("¿Quién va?"); el pago se queda en su superficie dedicada (/buy) porque
// los campos de MP + 3DS son frágiles dentro de una hoja. Ver
// docs/checkout-sheet-plan.md.
//
//  - Evento GRATIS  → se completa entero acá: datos → Confirmar → /processing.
//  - Evento PAGADO  → crea la orden reservada y entrega a /buy?order=id (resume
//    → pago), sin repetir datos ni meter PII en la URL.
//
// Reusa el MISMO form (`DatosForm`), el MISMO quote (`useOrderQuote`) y la MISMA
// mutación (`useBuyTickets`) que /buy — no duplica pricing ni validación.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { CheckoutPaySurface } from "./CheckoutPaySurface";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useBuyTickets, useOrderQuote } from "@/lib/tickets/hooks/useTickets";
import type { OrderQuote } from "@/server/tickets/domain/Ticket";
import { parseE164 } from "@/lib/phone/countries";
import { isValidDocument } from "@/lib/identity/document";
import {
  sealCheckoutSession,
  checkoutSessionKey,
} from "@/lib/_shared/checkoutSessionStorage";
import { persistOrderToken, processingQuery } from "@/lib/tickets/orderTokenStorage";
import { checkoutErrorMessage } from "@/lib/tickets/checkoutErrors";
import { formatPrice } from "@/lib/_shared/format";
import { DatosForm } from "./DatosForm";
import { ContactReview, ContactConfirmActions } from "./ContactConfirmSheet";

type CheckoutItem = { ticketTypeId: string; qty: number };

export function CheckoutSheet({
  open,
  onClose,
  eventId,
  slug,
  items,
  promo,
  accent,
  summaryLabel,
  fallbackTotalCents,
  resumePay,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  slug: string;
  items: CheckoutItem[];
  promo: string | null;
  accent?: string | null;
  /** "2 entradas · 1 box" — resumen legible de lo elegido. */
  summaryLabel: string;
  /** Suma local de `buyerPriceCents` (feedback instantáneo hasta que llega el quote). */
  fallbackTotalCents: number;
  /**
   * Reanudar pago tras recargar la URL interceptada (/buy?…&inline=1 → hard-nav
   * → redirige al evento con ?pay). Abre la hoja DIRECTO en pago (crecida), sin
   * datos ni quote: la orden ya existe y CheckoutPaySurface restaura todo de la
   * sesión sellada (sobrevive el reload en sessionStorage).
   */
  resumePay?: { orderId: string; orderToken: string | null } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useCurrentUser();
  const isLogged = !!me.data?.user;

  const buy = useBuyTickets();
  const quote = useOrderQuote();
  const [quoted, setQuoted] = useState<OrderQuote | null>(null);

  const [isForeigner, setIsForeigner] = useState(false);
  const [guestDni, setGuestDni] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Pasos dentro de la MISMA hoja (no apilamos): datos → revisión → yendo →
  // pago. `dir` da la dirección del slide (1 avanza, -1 retrocede) para que el
  // deslizamiento sea coherente con un wizard. El paso "pay" NO desliza: la
  // hoja CRECE a pantalla completa (Sheet.expanded) y monta ahí el pago.
  const [step, setStep] = useState<"form" | "confirm" | "processing" | "pay">("form");
  const [dir, setDir] = useState(1);

  // Orden pagada creada → superficie de pago dentro de la MISMA hoja (que crece).
  const [payInfo, setPayInfo] = useState<{ orderId: string; orderToken: string | null } | null>(null);
  // El pago (campos MP) se monta SOLO cuando el crecimiento terminó — montarlo
  // durante el transform rompe los iframes de Mercado Pago.
  const [payArrived, setPayArrived] = useState(false);

  const submittingRef = useRef(false);
  // ¿Ya llegamos a la URL …/buy estando en pago? Sirve para no cerrar la hoja en
  // la transición inicial (router.push es async: hay un render con step="pay"
  // pero pathname aún en …/[slug]). Solo cerramos cuando SALIMOS de …/buy.
  const enteredPayUrlRef = useRef(false);
  // Modo "reanudar pago" (abierta directo en pago tras recargar): la URL es el
  // evento (?pay), NO …/buy — así que la detección de "atrás" por pathname no
  // aplica, y la X cierra al evento (no hay paso de datos al que volver).
  const resumeModeRef = useRef(false);

  // Al abrir: pide el quote autoritativo para mostrar el total exacto.
  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    // Reanudar pago (recarga): saltamos directo al paso de pago crecido.
    if (resumePay) {
      resumeModeRef.current = true;
      setStep("pay");
      setDir(1);
      setPayInfo(resumePay);
      setPayArrived(false);
      submittingRef.current = false;
      return;
    }
    resumeModeRef.current = false;
    if (items.length === 0) return;
    setStep("form");
    setDir(1);
    setPayInfo(null);
    setPayArrived(false);
    // Reset del guard anti-doble-tap: tras un submit exitoso queda en true (no
    // se resetea en el happy path porque la hoja navegaba). Sin esto, re-abrir
    // la hoja (ej. tras dar atrás del pago) dejaría el segundo checkout colgado
    // en "Te llevamos a pagar" — submit() saldría temprano por el guard.
    submittingRef.current = false;
    quote.mutate(
      { eventId, items: items.map((i) => ({ ticketTypeId: i.ticketTypeId, qty: i.qty })) },
      {
        onSuccess: (q) => {
          setQuoted(q);
          if (q.totalCents !== fallbackTotalCents) {
            console.warn("[checkout] drift suma local vs total del server", {
              localTotal: fallbackTotalCents,
              serverTotal: q.totalCents,
            });
          }
        },
        onError: () => setQuoted(null),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Atrás (o el botón X) durante el pago: la URL vuelve de …/buy a …/[slug].
  // Solo cerramos cuando YA habíamos llegado a …/buy y luego salimos — así no se
  // cierra en la transición inicial (router.push async), que era el bug de
  // "se queda en ¡Perfecto! y cierra".
  useEffect(() => {
    if (resumeModeRef.current) return; // resume: URL = evento, no aplica
    if (step !== "pay") {
      enteredPayUrlRef.current = false;
      return;
    }
    if (pathname.endsWith("/buy")) {
      enteredPayUrlRef.current = true; // llegamos a la URL de pago
    } else if (enteredPayUrlRef.current) {
      onClose(); // ya estábamos en …/buy y salimos (atrás) → cerrar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, step]);

  // Autorrelleno del logueado (mismos campos que /buy).
  const prefilledRef = useRef(false);
  useEffect(() => {
    const u = me.data?.user;
    if (!u || prefilledRef.current) return;
    prefilledRef.current = true;
    if (u.fullName) setGuestName((prev) => prev || u.fullName!);
    if (u.dni) setGuestDni((prev) => prev || u.dni!);
    if (u.phone) setGuestPhone((prev) => prev || u.phone!);
    if (u.email) setGuestEmail((prev) => prev || u.email!);
  }, [me.data?.user]);

  // Validación idéntica a /buy.
  const emailOk = /.+@.+\..+/.test(guestEmail.trim());
  const phoneNational = parseE164(guestPhone).national;
  const phoneIsPeru = (parseE164(guestPhone).country?.code ?? "PE") === "PE";
  const phoneOk = phoneIsPeru ? phoneNational.length === 9 : phoneNational.length >= 6;
  const docValid = isValidDocument(guestDni, isForeigner);
  const guestValid =
    guestName.trim().length >= 2 && docValid && phoneOk && (isLogged || emailOk);

  const totalCents = quoted?.totalCents ?? fallbackTotalCents;
  const isFree = totalCents === 0;
  const totalQty = items.reduce((a, b) => a + b.qty, 0);

  const submit = async () => {
    if (submittingRef.current || !guestValid) return;
    submittingRef.current = true;
    setSubmitError(null);
    // El paso "yendo" debe sentirse como un beat deliberado, no un parpadeo: si
    // la red respondió muy rápido, lo sostenemos hasta ~700 ms antes de navegar.
    const t0 = Date.now();
    const holdBeat = async () => {
      const rest = 700 - (Date.now() - t0);
      if (rest > 0) await new Promise((r) => setTimeout(r, rest));
    };
    try {
      const attendee = {
        email: guestEmail.trim() || null,
        fullName: guestName.trim(),
        dni: guestDni.trim(),
        phone: guestPhone || null,
        isForeigner,
      };
      const res = await buy.mutateAsync({
        eventId,
        items,
        promoCode: promo,
        guest: isLogged ? undefined : attendee,
        buyer: isLogged ? attendee : undefined,
      });

      // La orden creada es la verdad final. Solo el server decide si es gratis.
      if (res.order.totalCents === 0) {
        const qs = processingQuery(res.order.id, res.orderToken ?? null, {
          total: 0,
          n: totalQty,
        });
        await holdBeat();
        router.push(`/events/${slug}/processing?${qs}` as never);
        return;
      }

      // Pagado: sella la sesión (mismo formato que /buy) y entrega a la
      // superficie de pago dedicada. El resume de /buy?order=id la restaura y
      // salta directo a "pagar" — sin repetir datos ni PII en la URL.
      const reservedNow = Date.now();
      const sealed = await sealCheckoutSession(res.order.id, {
        qty: Object.fromEntries(items.map((i) => [i.ticketTypeId, i.qty])),
        payMethod: "yape",
        guestEmail: guestEmail.trim(),
        guestName: guestName.trim(),
        guestDni: guestDni.trim(),
        guestPhone,
        orderToken: res.orderToken ?? null,
        reservedAt: reservedNow,
        // Total autoritativo: la superficie de pago lo usa sin re-cotizar.
        totalCents: res.order.totalCents,
      });
      try {
        sessionStorage.setItem(checkoutSessionKey(res.order.id), sealed);
      } catch {}
      if (res.orderToken) persistOrderToken(res.order.id, res.orderToken);
      const k = res.orderToken ? `&k=${encodeURIComponent(res.orderToken)}` : "";
      await holdBeat();
      // MISMA hoja que CRECE: guardamos la orden y pasamos al paso "pay" — el
      // Sheet expande a pantalla completa y monta el pago (no cerramos ni
      // abrimos otro overlay). Empujamos la URL a …/buy?order=…&inline=1 para
      // que refresh/atrás funcionen; `inline=1` le dice al intercept que NO
      // pinte su propio overlay (esta hoja ya está mostrando el pago). En
      // hard-nav/refresh cae la ruta real /buy (full page).
      setPayInfo({ orderId: res.order.id, orderToken: res.orderToken ?? null });
      setDir(1);
      setStep("pay");
      router.push(`/events/${slug}/buy?order=${res.order.id}${k}&inline=1` as never);
    } catch (e) {
      setSubmitError((e as Error).message);
      submittingRef.current = false;
      // Volvemos al formulario para mostrar el error (el paso "yendo" no lo
      // muestra) — retrocede, así el slide va en sentido correcto.
      setDir(-1);
      setStep("form");
    }
  };

  // X durante el pago: NO cierra la hoja — vuelve al paso de DATOS. La hoja
  // encoge (Sheet colapsa animado) y saca …/buy del historial (router.back).
  // Como ya seteamos step="form" antes de que el pathname cambie, el efecto de
  // arriba ve step≠"pay" y no dispara onClose. En datos, cierre normal.
  const handleDismiss = () => {
    if (step === "pay") {
      // Reanudado (recarga): no hay paso de datos al que volver ni /buy que
      // sacar del historial → cerrar al evento y limpiar ?pay de la URL.
      if (resumeModeRef.current) {
        onClose();
        router.replace(`/events/${slug}` as never);
        return;
      }
      setDir(-1);
      setStep("form");
      setPayInfo(null);
      setPayArrived(false);
      router.back();
    } else {
      onClose();
    }
  };

  // Avanza al micro-estado "yendo" (misma hoja) y dispara la creación de la
  // orden. Da feedback de que se confirmó antes de que la navegación ocurra.
  const goProcessing = () => {
    setDir(1);
    setStep("processing");
    void submit();
  };

  // Confirmamos el contacto de TODO invitado (gratis o pago) antes de continuar:
  // el QR llega por WhatsApp/correo y un typo lo pierde. Antes lo limitábamos a
  // gratis pensando que /buy mostraría el validador en el flujo pagado — pero al
  // reservar la orden y entrar a /buy?order=…, el resume salta directo a "pagar"
  // y NUNCA pasa por el paso de datos donde vive ese validador. Resultado: el
  // invitado que paga jamás confirmaba. Por eso va acá, para ambos. El logueado
  // sí salta (su correo de cuenta ya es un canal confiable).
  const needsContactConfirm = !isLogged;

  const handlePrimary = () => {
    if (!guestValid || buy.isPending) return;
    if (needsContactConfirm) {
      setDir(1);
      setStep("confirm");
      return;
    }
    goProcessing();
  };

  const ctaLabel = buy.isPending
    ? "Un momento…"
    : !guestValid
      ? "Completa tus datos"
      : isFree
        ? "Confirmar · Gratis"
        : `Ir a pagar · ${formatPrice(totalCents, "PEN")}`;

  // Copy del micro-estado "yendo" según haya o no algo que pagar.
  const processingTitle = isFree ? "¡Listo!" : "¡Perfecto!";
  const processingHint = isFree ? "Generando tu entrada…" : "Te llevamos a pagar…";

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && handleDismiss()}
      expanded={step === "pay"}
      onExpandComplete={() => setPayArrived(true)}
      title={
        step === "pay"
          ? "Pago"
          : step === "processing"
            ? processingTitle
            : step === "confirm"
              ? "Revisa tus datos de contacto"
              : "Completa tus datos"
      }
      description="Con estos datos generamos tu entrada y te enviamos el QR."
      maxWidth={520}
      footer={
        step === "processing" || step === "pay" ? null : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              {step === "confirm" ? (
                <ContactConfirmActions
                  onConfirm={goProcessing}
                  onEdit={() => {
                    setDir(-1);
                    setStep("form");
                  }}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handlePrimary}
                    disabled={!guestValid || buy.isPending}
                    className="w-full rounded-full bg-cart-accent py-3.5 text-[15px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
                  >
                    {ctaLabel}
                  </button>
                  {!isFree && (
                    <p className="mt-2 text-center text-[11px] text-cart-ink-4">
                      El pago (Yape o tarjeta) es el siguiente paso.
                    </p>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )
      }
    >
      {step === "pay" && payInfo ? (
        <motion.div
          className="pb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Cabecera del pago: "volver" (chevron ‹) — vuelve al paso de datos.
              Título del paso. */}
          <div className="mb-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Volver"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-cart-bg-elev-2 text-cart-ink-2 transition hover:text-cart-ink"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-[15px] font-bold tracking-[-0.01em] text-cart-ink">Pago</span>
          </div>
          {/* Crossfade entre "preparando" y el pago real (montado en payArrived,
              tras asentar el crecimiento — los campos MP se rompen si se montan
              durante el transform). */}
          <AnimatePresence mode="wait" initial={false}>
            {payArrived ? (
              <motion.div
                key="surface"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <CheckoutPaySurface
                  slug={slug}
                  orderId={payInfo.orderId}
                  orderToken={payInfo.orderToken}
                />
              </motion.div>
            ) : (
              <motion.div
                key="preparing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center py-14 text-center"
              >
                <div className="size-11 rounded-full border-[3px] border-cart-line-strong border-t-cart-accent animate-[spin_0.8s_linear_infinite]" />
                <p className="mt-4 text-[13.5px] text-cart-ink-2">Preparando el pago…</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
      /* Un paso a la vez, con deslizamiento: "revisar" entra desde la derecha,
          "corregir" vuelve desde la izquierda — el mismo modelo espacial que un
          wizard, sin apilar hojas. El AutoHeight acompaña el cambio de alto. */
      <AutoHeight>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 26 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -26 * dir }}
          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        >
          {step === "processing" ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="size-11 rounded-full border-[3px] border-cart-line-strong border-t-cart-accent animate-[spin_0.8s_linear_infinite]" />
              <h2 className="mt-5 text-[20px] font-bold tracking-[-0.02em] text-cart-ink">
                {processingTitle}
              </h2>
              <p className="mt-1.5 text-[13.5px] text-cart-ink-2">{processingHint}</p>
            </div>
          ) : step === "confirm" ? (
            <ContactReview phone={guestPhone} email={guestEmail} />
          ) : (
            <>
              {/* Resumen de lo que se lleva + total (el total lo pisa el quote). */}
              <div className="mb-1 flex items-center justify-between gap-3 pb-1">
                <span className="text-[13px] text-cart-ink-3">{summaryLabel}</span>
                <span
                  className="text-[15px] font-bold"
                  style={{ color: accent ?? "var(--color-cart-accent)" }}
                >
                  {isFree ? "Gratis" : formatPrice(totalCents, "PEN")}
                </span>
              </div>

              <DatosForm
                isLogged={isLogged}
                userIdent={me.data?.user?.email ?? me.data?.user?.phone ?? null}
                isForeigner={isForeigner}
                setIsForeigner={setIsForeigner}
                guestDni={guestDni}
                setGuestDni={setGuestDni}
                guestName={guestName}
                setGuestName={setGuestName}
                guestPhone={guestPhone}
                setGuestPhone={setGuestPhone}
                guestEmail={guestEmail}
                setGuestEmail={setGuestEmail}
              />
              {submitError && (
                <p className="mt-4 text-center text-[12.5px] text-rose-400">
                  {checkoutErrorMessage(submitError)}
                </p>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
      </AutoHeight>
      )}
    </Sheet>
  );
}

// Anima el ALTO de la hoja entre pasos: mide el contenido con ResizeObserver y
// transiciona `height`, así el crecer/encoger no salta de golpe. El contenido
// interno hace su propio slide/fade (sin tocar el alto), y este wrapper lo
// acompaña con el mismo timing.
function AutoHeight({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    // Guard de igualdad: solo re-renderiza si el alto CAMBIÓ. Como observamos el
    // div interno (contenido) y animamos el div externo, no hay realimentación;
    // el guard es cinturón de seguridad contra bucles de ResizeObserver.
    const measure = () => {
      const h = el.offsetHeight;
      setHeight((prev) => (prev === h ? prev : h));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div
      animate={{ height }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
      style={{ overflow: "hidden" }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}

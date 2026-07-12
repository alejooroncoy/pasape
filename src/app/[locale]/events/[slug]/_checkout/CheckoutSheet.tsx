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

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/Sheet";
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
import { formatPrice } from "@/lib/_shared/format";
import { DatosForm } from "./DatosForm";

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
}) {
  const router = useRouter();
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

  const submittingRef = useRef(false);

  // Al abrir: pide el quote autoritativo para mostrar el total exacto.
  useEffect(() => {
    if (!open || items.length === 0) return;
    setSubmitError(null);
    quote.mutate(
      { eventId, items: items.map((i) => ({ ticketTypeId: i.ticketTypeId, qty: i.qty })) },
      { onSuccess: setQuoted, onError: () => setQuoted(null) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      });
      try {
        sessionStorage.setItem(checkoutSessionKey(res.order.id), sealed);
      } catch {}
      if (res.orderToken) persistOrderToken(res.order.id, res.orderToken);
      const k = res.orderToken ? `&k=${encodeURIComponent(res.orderToken)}` : "";
      router.push(`/events/${slug}/buy?order=${res.order.id}${k}` as never);
    } catch (e) {
      setSubmitError((e as Error).message);
      submittingRef.current = false;
    }
  };

  const ctaLabel = buy.isPending
    ? "Un momento…"
    : !guestValid
      ? "Completa tus datos"
      : isFree
        ? "Confirmar · Gratis"
        : `Ir a pagar · ${formatPrice(totalCents, "PEN")}`;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Completa tus datos"
      description="Con esto armamos tu entrada y te enviamos el QR."
      maxWidth={520}
      footer={
        <>
          <button
            type="button"
            onClick={submit}
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
      }
    >
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
        <p className="mt-4 text-center text-[12.5px] text-rose-300">
          No pudimos crear tu pedido. Revisa tu conexión e intenta de nuevo.
        </p>
      )}
    </Sheet>
  );
}

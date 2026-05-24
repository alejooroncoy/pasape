"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BackBtn,
  Btn,
  BuyTicketRow,
  C,
  CloseBtn,
  Field,
  FONT_DISPLAY,
  Phone,
  PriceRow,
  StepDots,
} from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useBuyTickets } from "@/lib/tickets/hooks/useTickets";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useDniLookup } from "@/lib/identity/hooks/useDniLookup";
import { formatMoney } from "@/lib/_shared/format";
import { CardForm } from "@/components/payments/CardForm";
import { YapeForm } from "@/components/payments/YapeForm";

type Props = { params: Promise<{ slug: string }> };

type Step = 0 | 1 | 2;

export default function BuyFlowPage(props: Props) {
  return (
    <Suspense fallback={null}>
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
  const search = useSearchParams();
  const [step, setStep] = useState<Step>(0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"yape" | "mp">("yape");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestDni, setGuestDni] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const nameTouchedRef = useRef(false);
  const { lookup: dniLookup, pending: dniPending } = useDniLookup();
  const [dniHint, setDniHint] = useState<"idle" | "not_found">("idle");

  // Why: cuando el DNI llega a 8 dígitos, llamamos a Decolecta (RENIEC) y
  // autocompletamos el nombre si el usuario no lo ha tocado todavía.
  useEffect(() => {
    if (guestDni.length !== 8) {
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
  }, [guestDni, dniLookup]);

  useEffect(() => {
    const key = `pasape:promo:${slug}`;
    const fromUrl = search.get("promo");
    let next: string | null = null;
    if (fromUrl) {
      next = fromUrl;
      try {
        window.localStorage.setItem(key, fromUrl);
      } catch {}
    } else {
      try {
        next = window.localStorage.getItem(key);
      } catch {}
    }
    if (next) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync de fuente externa (URL + localStorage)
      setPromoCode(next);
    }
  }, [slug, search]);

  // Why: si recargan la página en paso 2, restauramos el estado desde la URL
  // (orderId) + sessionStorage (qty + datos del form). Así no pierden todo.
  // Se ejecuta una sola vez al montar.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setStep(2);
    } catch {}
  }, []);

  if (!data) return <Phone><div style={{ padding: 28, color: C.dim }}>Cargando…</div></Phone>;

  const items = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([ticketTypeId, q]) => ({ ticketTypeId, qty: q }));
  const total = data.ticketTypes.reduce(
    (sum, tt) => sum + tt.priceCents * (qty[tt.id] ?? 0),
    0,
  );
  const totalItems = items.reduce((a, b) => a + b.qty, 0);
  const fee = totalItems > 0 ? 300 : 0;

  const isLogged = !!me.data?.user;
  // Why: WhatsApp es siempre requerido (canal principal del QR). Email es
  // opcional en este paso. Si en el paso 2 elige tarjeta y no tiene email,
  // se lo pedimos ahí antes de mostrar el form de tarjeta (MP lo exige).
  const emailOk = /.+@.+\..+/.test(guestEmail.trim());
  const phoneOk = guestPhone.replace(/\D/g, "").length === 9;
  const guestValid =
    guestName.trim().length >= 2 &&
    guestDni.trim().length === 8 &&
    phoneOk;

  const startPayment = async () => {
    try {
      const res = await buy.mutateAsync({
        eventId: data.event.id,
        items,
        promoCode,
        guest: isLogged
          ? undefined
          : {
              email: guestEmail.trim() || null,
              fullName: guestName.trim(),
              dni: guestDni.trim(),
              phone: guestPhone.replace(/\D/g, "") || null,
            },
      });
      setPreferenceId(res.preference.id);
      setOrderId(res.order.id);
      setStep(2);
      // Persist para sobrevivir reload en paso 2. La URL lleva el order; el
      // sessionStorage guarda los datos del form para prefill del payment widget.
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
            guestPhone: guestPhone.replace(/\D/g, ""),
          }),
        );
      } catch {}
    } catch (e) {
      const reason = encodeURIComponent((e as Error).message || "unknown");
      router.replace(`/events/${slug}/pay-error?reason=${reason}`);
    }
  };

  const goNext = () => {
    // Why: el comprador es commodity — no exigimos login. Si no hay sesión,
    // el paso 2 muestra el formulario guest. La validación se hace en step 1.
    if (step === 0 && totalItems > 0) {
      setStep(1);
    } else if (step === 1) {
      if (!isLogged && !guestValid) return;
      void startPayment();
    }
  };

  return (
    <Phone>
      <div style={{ padding: "6px 22px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((step - 1) as Step)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              background: "rgba(255,255,255,0.06)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
              border: 0,
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3l-5 5 5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <BackBtn />
        )}
        <StepDots step={step} of={3} />
        <CloseBtn />
      </div>

      {step === 0 && (
        <div style={{ padding: "22px 22px 110px" }}>
          <div style={{ fontSize: 12, color: C.purple, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
            PASO 1 DE 3
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 0.95 }}>
            Elegí tu entrada.
          </div>

          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            {data.ticketTypes.map((tt) => {
              const remaining = tt.capacity - tt.sold;
              return (
                <BuyTicketRow
                  key={tt.id}
                  name={tt.name}
                  sub={remaining > 0 ? `${remaining} disponibles` : "agotada"}
                  priceCents={tt.priceCents}
                  qty={qty[tt.id] ?? 0}
                  onChange={(next) => setQty({ ...qty, [tt.id]: next })}
                  remaining={remaining}
                  accent={tt.kind === "vip" ? C.yellow : tt.kind === "box" ? C.red : null}
                  disabled={remaining === 0}
                />
              );
            })}
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ padding: "20px 22px 110px" }}>
          <div style={{ fontSize: 12, color: C.purple, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
            PASO 2 DE 3
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
              marginBottom: 18,
            }}
          >
            ¿Quién va?
          </div>

          {isLogged ? (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                marginBottom: 16,
                background: "rgba(124,58,237,0.10)",
                boxShadow: "0 0 0 1.5px rgba(124,58,237,0.35) inset",
              }}
            >
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>Usar datos de mi cuenta</div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                {me.data?.user?.fullName ?? "—"} · {me.data?.user?.email ?? me.data?.user?.phone ?? "—"}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
                Tu QR llega por WhatsApp o email. Sin contraseña.
              </div>
              <Field
                label="DNI"
                mono
                value={guestDni}
                onChange={(e) => {
                  nameTouchedRef.current = false;
                  setGuestDni(e.target.value.replace(/\D/g, "").slice(0, 8));
                }}
                placeholder="71234567"
                active={guestDni.length > 0}
                hint={
                  dniHint === "not_found"
                    ? "DNI no encontrado en RENIEC — ingresá tu nombre manualmente"
                    : undefined
                }
              />
              <Field
                label="Nombre completo"
                value={guestName}
                onChange={(e) => {
                  nameTouchedRef.current = true;
                  setGuestName(e.target.value);
                }}
                placeholder={dniPending ? "Buscando en RENIEC…" : "Juan Pérez García"}
                active={guestName.length > 0}
                disabled={dniPending}
              />
              <Field
                label="WhatsApp"
                mono
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="987 654 321"
                active={guestPhone.length > 0}
              />
              <Field
                label="Email (opcional)"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="juan@gmail.com"
                active={guestEmail.length > 0}
                hint="Obligatorio si pagaras con tarjeta — si no lo completas ahora, te lo pedimos en el siguiente paso."
              />
            </div>
          )}

          <div style={{ marginTop: 22, padding: "16px 18px", background: C.bg2, borderRadius: 18, boxShadow: `0 0 0 1px ${C.line} inset` }}>
            {data.ticketTypes
              .filter((tt) => (qty[tt.id] ?? 0) > 0)
              .map((tt) => (
                <PriceRow
                  key={tt.id}
                  label={`${tt.name} × ${qty[tt.id]}`}
                  value={formatMoney(tt.priceCents * qty[tt.id])}
                />
              ))}
            <div style={{ height: 1, background: C.line, margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Total</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em" }}>
                {formatMoney(total)}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ padding: "20px 22px 140px" }}>
          <div style={{ fontSize: 12, color: C.purple, letterSpacing: "0.08em", fontWeight: 700, marginBottom: 6 }}>
            PASO 3 DE 3
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>
            Pagá tu entrada.
          </div>

          <div style={{ marginBottom: 16, padding: "16px 18px", background: C.bg2, borderRadius: 18, boxShadow: `0 0 0 1px ${C.line} inset` }}>
            {data.ticketTypes
              .filter((tt) => (qty[tt.id] ?? 0) > 0)
              .map((tt) => (
                <PriceRow
                  key={tt.id}
                  label={`${tt.name} × ${qty[tt.id]}`}
                  value={formatMoney(tt.priceCents * qty[tt.id])}
                />
              ))}
            <PriceRow label="Servicio" value={formatMoney(fee)} />
            <div style={{ height: 1, background: C.line, margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Total</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em" }}>
                {formatMoney(total + fee)}
              </div>
            </div>
          </div>

          {orderId ? (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <PayMethodPill
                  active={payMethod === "yape"}
                  onClick={() => setPayMethod("yape")}
                  label="Yape"
                  sub="Paga en 2 segundos"
                  badge="MÁS RÁPIDO"
                  icon={<YapeIcon />}
                />
                <PayMethodPill
                  active={payMethod === "mp"}
                  onClick={() => setPayMethod("mp")}
                  label="Tarjeta"
                  sub="Crédito · Débito"
                  badge={null}
                  icon={<CardIcon />}
                />
              </div>
              {payMethod === "yape" ? (
                <YapeForm
                  orderId={orderId}
                  amount={(total + fee) / 100}
                  initialPhone={isLogged ? me.data?.user?.phone ?? "" : guestPhone}
                  onPaid={() => {
                    try {
                      sessionStorage.removeItem(`pasape:buy:${orderId}`);
                    } catch {}
                    router.push(`/events/${slug}/processing?order=${orderId}`);
                  }}
                  onError={(msg) => {
                    // No redirige a pay-error: Yape errors son recuperables
                    // (código vencido / saldo). Dejamos al usuario reintentar.
                    console.warn("yape error:", msg);
                  }}
                />
              ) : !isLogged && !emailOk ? (
                <div
                  style={{
                    background: C.bg2,
                    borderRadius: 18,
                    padding: 18,
                    boxShadow: `0 0 0 1px ${C.line} inset`,
                  }}
                >
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                    Necesitamos tu email
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, marginBottom: 14, lineHeight: 1.5 }}>
                    Para pagar con tarjeta, Mercado Pago requiere tu correo. Es solo para el comprobante.
                  </div>
                  <Field
                    label="Email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="juan@gmail.com"
                    active={guestEmail.length > 0}
                  />
                </div>
              ) : (
                <CardForm
                  orderId={orderId}
                  amount={(total + fee) / 100}
                  initialHolder={isLogged ? me.data?.user?.fullName ?? "" : guestName}
                  initialDni={isLogged ? "" : guestDni}
                  initialEmail={isLogged ? me.data?.user?.email ?? "" : guestEmail}
                  onPaid={() => {
                    try {
                      sessionStorage.removeItem(`pasape:buy:${orderId}`);
                    } catch {}
                    router.push(`/events/${slug}/processing?order=${orderId}`);
                  }}
                  onError={(msg) => {
                    console.warn("card error:", msg);
                  }}
                />
              )}
            </>
          ) : (
            <div style={{ color: C.dim, fontSize: 13, textAlign: "center" }}>Preparando el checkout…</div>
          )}

          <div style={{ marginTop: 12, fontSize: 12, color: C.dim, textAlign: "center" }}>
            Tu QR llega a tu cuenta ni bien confirmemos el pago
          </div>
        </div>
      )}

      {step !== 2 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, padding: "0 22px" }}>
          {buy.error && (
            <div style={{ marginBottom: 10, fontSize: 12, color: C.red, textAlign: "center" }}>
              {(buy.error as Error).message}
            </div>
          )}
          <Btn
            onClick={goNext}
            disabled={
              buy.isPending ||
              (step === 0 && totalItems === 0) ||
              (step === 1 && !isLogged && !guestValid)
            }
          >
            {buy.isPending
              ? "Procesando…"
              : step === 0
                ? totalItems === 0
                  ? "Elegí una entrada"
                  : `Continuar · ${formatMoney(total)}`
                : `Ir a pagar · ${formatMoney(total + fee)}`}
          </Btn>
        </div>
      )}
    </Phone>
  );
}

function PayMethodPill({
  active,
  onClick,
  label,
  sub,
  badge,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  badge: string | null;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "14px 14px",
        borderRadius: 18,
        border: 0,
        background: active
          ? "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))"
          : "rgba(255,255,255,0.04)",
        boxShadow: active
          ? "0 0 0 2px #fff inset, 0 12px 30px -12px rgba(124,58,237,0.55)"
          : `0 0 0 1px ${C.line} inset`,
        color: "#fff",
        textAlign: "left",
        cursor: "pointer",
        position: "relative",
        transition: "all 120ms ease",
      }}
    >
      {badge && (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: 10,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.08em",
            padding: "3px 7px",
            borderRadius: 6,
            background: C.green,
            color: "#062315",
            boxShadow: "0 4px 12px rgba(34,209,127,0.4)",
          }}
        >
          {badge}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: active ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, lineHeight: 1.1 }}>
            {label}
          </div>
          <div style={{ fontSize: 11, color: active ? "rgba(255,255,255,0.75)" : C.dim, marginTop: 3 }}>
            {sub}
          </div>
        </div>
      </div>
    </button>
  );
}

const YapeIcon = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/brand/yape.png"
    alt="Yape"
    width={36}
    height={36}
    style={{ display: "block", borderRadius: 8 }}
  />
);

const CardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="4" width="18" height="14" rx="2.5" stroke="#fff" strokeWidth="1.6" />
    <rect x="2" y="7.5" width="18" height="2.5" fill="#fff" />
    <rect x="5" y="13" width="4" height="2" rx="0.5" fill="#fff" opacity="0.7" />
  </svg>
);

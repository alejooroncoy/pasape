"use client";

import { useEffect, useRef, useState } from "react";
import { useMpSdk, type BinChangeData, type MpField } from "@/lib/payments/hooks/useMpSdk";

// PCI SAQ-A: la tarjeta se captura con Secure Fields de MP (iframes montados por
// el SDK). El PAN/expiración/CVV NUNCA tocan nuestro DOM ni nuestro servidor:
// `mp.fields.createCardToken()` los lee directo de los iframes y devuelve un
// token; a nuestro backend solo viaja ese token. Ya no existe /api/payments/tokenize.

type Props = {
  orderId: string;
  amount: number;
  initialHolder?: string;
  initialDni?: string;
  initialEmail?: string;
  onPaid: () => void;
  onError?: (message: string) => void;
};

type CardBrand = "visa" | "master" | "amex" | "diners" | "unknown";

const brandFromPaymentMethodId = (id: string | null): CardBrand => {
  if (!id) return "unknown";
  if (id.includes("visa")) return "visa";
  if (id.includes("master")) return "master";
  if (id.includes("amex")) return "amex";
  if (id.includes("diners")) return "diners";
  return "unknown";
};

// Estilo del input DENTRO del iframe seguro de MP (no lo controla nuestro CSS).
const SECURE_FIELD_STYLE: Record<string, unknown> = {
  color: "#FFFFFF",
  "font-size": "15px",
  "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
  placeholderColor: "rgba(255,255,255,0.32)",
};

export function CardForm({
  orderId,
  amount,
  initialHolder,
  initialDni,
  initialEmail: _initialEmail,
  onPaid,
  onError,
}: Props) {
  const mp = useMpSdk(onError);
  const [holder, setHolder] = useState(initialHolder ?? "");
  const [dni, setDni] = useState(initialDni ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [fieldsReady, setFieldsReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cuando el emisor exige 3DS, guardamos el challenge para renderizarlo.
  const [challenge, setChallenge] = useState<{ externalResourceUrl: string; creq: string } | null>(null);

  // Instancias de los Secure Fields — se montan una sola vez cuando el SDK está
  // listo y se desmontan al salir. Los refs evitan re-montar en cada render.
  const mountedRef = useRef(false);
  const fieldsRef = useRef<MpField[]>([]);

  useEffect(() => {
    if (!mp || mountedRef.current) return;
    mountedRef.current = true;
    try {
      const cardNumber = mp.fields
        .create("cardNumber", { placeholder: "1234 1234 1234 1234", style: SECURE_FIELD_STYLE })
        .mount("mp-card-number");
      const expiration = mp.fields
        .create("expirationDate", { placeholder: "MM/AA", style: SECURE_FIELD_STYLE })
        .mount("mp-card-exp");
      const securityCode = mp.fields
        .create("securityCode", { placeholder: "CVV", style: SECURE_FIELD_STYLE })
        .mount("mp-card-cvv");
      fieldsRef.current = [cardNumber, expiration, securityCode];

      // El bin (8 dígitos) llega por evento del propio iframe — no podemos leer
      // los dígitos nosotros. Con él resolvemos el medio de pago real (crédito
      // vs débito, marca) desde MP.
      cardNumber.on("binChange", async (raw) => {
        const bin = (raw as BinChangeData)?.bin ?? null;
        if (!bin || bin.length < 6) {
          setPaymentMethodId(null);
          return;
        }
        try {
          const res = await mp.getPaymentMethods({ bin });
          setPaymentMethodId(res?.results?.[0]?.id ?? null);
        } catch {
          setPaymentMethodId(null);
        }
      });
      setFieldsReady(true);
    } catch (e) {
      onError?.((e as Error).message ?? "mp_fields_failed");
    }

    return () => {
      for (const f of fieldsRef.current) {
        try {
          f.unmount();
        } catch {}
      }
      fieldsRef.current = [];
      mountedRef.current = false;
    };
  }, [mp, onError]);

  const brand = brandFromPaymentMethodId(paymentMethodId);
  const canSubmit =
    !submitting &&
    !!mp &&
    fieldsReady &&
    holder.trim().length >= 2 &&
    dni.length >= 8 &&
    !!paymentMethodId;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !mp || !paymentMethodId) return;
    setSubmitting(true);
    setError(null);
    try {
      // Tokenización en el cliente: MP lee la tarjeta de sus iframes seguros.
      // Si algún campo está incompleto/ inválido, esto lanza con `cause`.
      let token: { id: string };
      try {
        token = await mp.fields.createCardToken({
          cardholderName: holder.trim(),
          identificationType: "DNI",
          identificationNumber: dni,
        });
      } catch (tokenErr) {
        const cause = (tokenErr as { cause?: Array<{ code?: string }> })?.cause?.[0]?.code;
        const code = cause ?? "token_failed";
        setError(humanizeCardError(code));
        onError?.(code);
        return;
      }
      if (!token?.id) {
        setError(humanizeCardError("token_failed"));
        return;
      }

      const res = await fetch("/api/payments/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          token: token.id,
          paymentMethodId,
          installments: 1,
          // Device fingerprint que el SDK v2 crea al cargar (antifraude).
          deviceId: typeof window !== "undefined" ? window.MP_DEVICE_SESSION_ID ?? null : null,
        }),
      });
      const body = (await res.json()) as {
        data?: {
          status: string;
          paymentId: string;
          message?: string;
          threeDsInfo?: { externalResourceUrl: string; creq: string };
        };
        error?: string;
      };
      if (!res.ok || body.error) {
        const errMsg = body.error ?? `HTTP ${res.status}`;
        setError(humanizeCardError(errMsg));
        onError?.(errMsg);
        return;
      }
      const value = body.data;
      if (!value) {
        setError(humanizeCardError("empty_response"));
        return;
      }
      if (value.status === "challenge" && value.threeDsInfo) {
        // 3DS: el emisor pide autenticar. Mostramos el challenge del banco; el
        // resultado se resuelve por webhook + polling en /processing tras COMPLETE.
        setChallenge(value.threeDsInfo);
      } else if (value.status === "approved" || value.status === "in_process") {
        onPaid();
      } else {
        setError(humanizeCardError(value.message ?? "rejected"));
        onError?.(value.message ?? "rejected");
      }
    } catch (e) {
      const msg = (e as Error).message ?? "card_failed";
      setError(humanizeCardError(msg));
      onError?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mp) {
    return (
      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-6 text-center text-[13px] text-cart-ink-3">
        Cargando…
      </div>
    );
  }

  // 3DS activo: reemplazamos el formulario por el challenge del banco. Al
  // completarse (evento "COMPLETE"), continuamos a /processing, que hace polling
  // del estado hasta que el webhook confirme (approved/rejected).
  if (challenge) {
    return (
      <ThreeDsChallenge
        info={challenge}
        onComplete={onPaid}
        onCancel={() => setChallenge(null)}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-cart-line bg-cart-bg-elev p-5">
      <div className="text-[16px] font-semibold tracking-[-0.01em]">Paga con tu tarjeta</div>
      <p className="mt-1 text-[12.5px] text-cart-ink-3">
        Visa, Mastercard, AMEX, Diners — débito o crédito.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {/* Número de tarjeta — Secure Field (iframe de MP) */}
        <CardField label="Número de tarjeta">
          <div className="relative">
            <div
              id="mp-card-number"
              className="block h-[50px] w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 pr-14 transition focus-within:border-cart-accent focus-within:shadow-[0_0_0_3px_var(--color-cart-accent-soft)] [&>iframe]:h-full [&>iframe]:w-full"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <BrandIcon brand={brand} />
            </span>
          </div>
        </CardField>

        <div className="grid grid-cols-2 gap-3">
          <CardField label="Vencimiento">
            <div
              id="mp-card-exp"
              className="block h-[50px] w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 transition focus-within:border-cart-accent focus-within:shadow-[0_0_0_3px_var(--color-cart-accent-soft)] [&>iframe]:h-full [&>iframe]:w-full"
            />
          </CardField>
          <CardField label="CVV">
            <div
              id="mp-card-cvv"
              className="block h-[50px] w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 transition focus-within:border-cart-accent focus-within:shadow-[0_0_0_3px_var(--color-cart-accent-soft)] [&>iframe]:h-full [&>iframe]:w-full"
            />
          </CardField>
        </div>

        <CardField label="Nombre del titular">
          <input
            type="text"
            autoComplete="cc-name"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="María López"
            className="block w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 py-3.5 text-[15px] text-white outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
          />
        </CardField>

        <CardField label="DNI del titular">
          <input
            type="tel"
            inputMode="numeric"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 12))}
            placeholder="71234567"
            className="block w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 py-3.5 font-mono text-[15px] tracking-[0.04em] text-white outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
          />
        </CardField>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
      >
        {submitting ? "Procesando…" : `Pagar S/ ${amount.toFixed(2)}`}
      </button>

      <p className="mt-3 text-center text-[11px] text-cart-ink-4">
        Pago seguro · Procesado por Mercado Pago
      </p>
    </form>
  );
}

// Challenge 3DS: monta un iframe y le postea el `creq` al `external_resource_url`
// del banco (contrato de MP). El banco emite un `message` con status "COMPLETE"
// cuando el usuario termina — ahí seguimos a /processing (el estado final del
// pago se resuelve async por webhook, no es inmediato). El challenge DEBE
// arrancar en <30s de creado el pago: por eso se postea al montar.
function ThreeDsChallenge({
  info,
  onComplete,
  onCancel,
}: {
  info: { externalResourceUrl: string; creq: string };
  onComplete: () => void;
  onCancel: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const iframe = document.createElement("iframe");
    iframe.name = "mp-3ds-frame";
    // El contenido es del banco (cross-origin): NO podemos estilarlo por dentro.
    // Lo tratamos como una tarjeta con alto acotado; si el contenido del banco
    // es más alto, el propio iframe hace scroll (no lo corta).
    iframe.className = "block h-[520px] w-full border-0 bg-white";
    iframe.addEventListener("load", () => setLoading(false));
    host.appendChild(iframe);

    const idoc = iframe.contentWindow?.document;
    if (idoc) {
      const form = idoc.createElement("form");
      form.name = "mp-3ds-form";
      form.setAttribute("target", "mp-3ds-frame");
      form.setAttribute("method", "post");
      form.setAttribute("action", info.externalResourceUrl);
      const field = idoc.createElement("input");
      field.setAttribute("type", "hidden");
      field.setAttribute("name", "creq");
      field.setAttribute("value", info.creq);
      form.appendChild(field);
      idoc.body.appendChild(form);
      form.submit();
    }

    const onMessage = (e: MessageEvent) => {
      const data = e.data as { status?: string } | null;
      if (data?.status === "COMPLETE") onComplete();
    };
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
      try {
        host.removeChild(iframe);
      } catch {}
    };
  }, [info, onComplete]);

  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev p-5">
      {/* Header: candado + copy claro de por qué aparece esta pantalla */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-cart-accent-soft text-cart-accent">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 2l7 3v6c0 4.4-3 8.4-7 9.5C8 19.4 5 15.4 5 11V5l7-3z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M9.2 12l2 2 3.6-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="text-[16px] font-semibold tracking-[-0.01em]">Verificación de tu banco</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-cart-ink-3">
            Tu banco pide confirmar el pago para proteger tu tarjeta. Completa la verificación
            aquí abajo — <span className="text-cart-ink-2">no cierres ni recargues</span> esta pantalla.
          </p>
        </div>
      </div>

      {/* Marco del challenge: el iframe del banco (blanco) se muestra como una
          TARJETA CENTRADA sobre el panel oscuro (no a lo ancho). No podemos
          centrar el contenido POR DENTRO (cross-origin), así que centramos la
          tarjeta y le damos un ancho acotado tipo challenge window de 3DS. */}
      <div className="mt-4 flex justify-center rounded-2xl border border-cart-line bg-cart-bg p-3 sm:p-5">
        <div className="relative w-full max-w-[440px]">
          {loading && (
            <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-white">
              <div className="flex flex-col items-center gap-3">
                <span className="size-7 animate-spin rounded-full border-[3px] border-black/15 border-t-black/70" />
                <span className="text-[12.5px] font-medium text-black/55">Conectando con tu banco…</span>
              </div>
            </div>
          )}
          {/* MP monta el iframe (bg-white, alto fijo) aquí dentro */}
          <div ref={hostRef} className="overflow-hidden rounded-xl shadow-[0_12px_40px_-16px_rgba(0,0,0,0.6)]" />
        </div>
      </div>

      {/* Salida: botón visible para que el usuario nunca quede atrapado. */}
      <button
        type="button"
        onClick={onCancel}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-cart-line bg-cart-bg-elev-2 py-3.5 text-[14px] font-semibold text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Cancelar y volver
      </button>

      <p className="mt-3 text-center text-[11px] text-cart-ink-4">
        Autenticación segura 3-D Secure · Procesado por Mercado Pago
      </p>
    </div>
  );
}

function CardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function BrandIcon({ brand }: { brand: CardBrand }) {
  if (brand === "visa")
    return (
      <span className="grid h-7 w-10 place-items-center rounded-md bg-white text-[10px] font-black italic text-[#1a1f71]">
        VISA
      </span>
    );
  if (brand === "master")
    return (
      <span className="grid h-7 w-10 place-items-center rounded-md bg-white">
        <span className="flex items-center">
          <span className="size-3 rounded-full bg-[#eb001b]" />
          <span className="-ml-1 size-3 rounded-full bg-[#f79e1b] mix-blend-multiply" />
        </span>
      </span>
    );
  if (brand === "amex")
    return (
      <span className="grid h-7 w-10 place-items-center rounded-md bg-[#2e77bb] text-[8.5px] font-bold text-white">
        AMEX
      </span>
    );
  if (brand === "diners")
    return (
      <span className="grid h-7 w-10 place-items-center rounded-md bg-[#0a64a4] text-[7.5px] font-bold text-white">
        DINERS
      </span>
    );
  return (
    <span className="grid h-7 w-10 place-items-center rounded-md border border-cart-line text-cart-ink-3">
      <svg width="20" height="14" viewBox="0 0 24 16" fill="none">
        <rect x="0.5" y="0.5" width="23" height="15" rx="2" stroke="currentColor" />
        <rect x="0" y="3" width="24" height="2.5" fill="currentColor" opacity="0.4" />
      </svg>
    </span>
  );
}

function humanizeCardError(raw: string): string {
  switch (raw) {
    case "cc_rejected_bad_filled_card_number":
      return "Revisa el número de tarjeta.";
    case "cc_rejected_bad_filled_date":
    case "cc_rejected_bad_filled_security_code":
      return "Revisa la fecha o el CVV.";
    case "cc_rejected_insufficient_amount":
      return "Saldo insuficiente.";
    case "cc_rejected_high_risk":
      return "El pago fue rechazado por seguridad. Prueba con otra tarjeta.";
    case "cc_rejected_call_for_authorize":
      return "Tu banco pide autorización. Llámalos y autoriza el cargo.";
    case "cc_rejected_other_reason":
      return "Tu banco rechazó el pago. Prueba con otra tarjeta.";
    case "empty_response":
      return "No recibimos respuesta del banco. Vuelve a intentar.";
    default:
      return "No pudimos cobrarte. Revisa los datos o usa otra tarjeta.";
  }
}

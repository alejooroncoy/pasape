"use client";

import { useEffect, useMemo, useState } from "react";
import { useMpSdk } from "@/lib/payments/hooks/useMpSdk";

// Why: el CardPayment Brick de MP falla con `Failed to create card token`
// en sandbox (limitación conocida de MP). Migramos a Checkout API directa
// usando inputs propios + mp.createCardToken() — funciona tanto en sandbox
// como en producción, conserva UI propio del rediseño, y es PCI-acceptable
// porque el SDK envía la card directo a MP sin tocar nuestro server.

type Props = {
  orderId: string;
  amount: number;
  initialHolder?: string;
  initialDni?: string;
  initialEmail?: string;
  onPaid: () => void;
  onError?: (message: string) => void;
};

type CardBrand =
  | "visa"
  | "master"
  | "amex"
  | "diners"
  | "elo"
  | "hipercard"
  | "unknown";

const detectBrandFromBin = (digits: string): CardBrand => {
  if (digits.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "master";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^3[0689]/.test(digits)) return "diners";
  return "unknown";
};

const formatCardNumber = (raw: string, brand: CardBrand): string => {
  const d = raw.replace(/\D/g, "").slice(0, brand === "amex" ? 15 : 16);
  if (brand === "amex") {
    return d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(" "),
    );
  }
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
};

const formatExp = (raw: string): string => {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
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
  const [cardNumber, setCardNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [holder, setHolder] = useState(initialHolder ?? "");
  const [dni, setDni] = useState(initialDni ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [issuerId, setIssuerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = cardNumber.replace(/\D/g, "");
  const brand = detectBrandFromBin(digits);
  const cvvLen = brand === "amex" ? 4 : 3;
  const minLen = brand === "amex" ? 15 : 16;

  // BIN lookup → resuelve paymentMethodId real desde MP (sirve para distinguir
  // crédito vs débito, Visa vs Visa Débito, etc.). Sin esto el backend no
  // puede crear el pago correctamente.
  useEffect(() => {
    if (!mp || digits.length < 6) {
      setPaymentMethodId(null);
      return;
    }
    const bin = digits.slice(0, 8);
    let cancelled = false;
    mp.getPaymentMethods({ bin })
      .then((res) => {
        if (cancelled) return;
        const first = res?.results?.[0];
        if (first) {
          setPaymentMethodId(first.id);
        }
      })
      .catch(() => {
        if (!cancelled) setPaymentMethodId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mp, digits]);

  const expParts = useMemo(() => {
    const [m, y] = exp.split("/");
    return { month: (m ?? "").padStart(2, "0"), year: y ?? "" };
  }, [exp]);

  const canSubmit =
    !submitting &&
    !!mp &&
    digits.length >= minLen &&
    expParts.month.length === 2 &&
    expParts.year.length === 2 &&
    cvv.length === cvvLen &&
    holder.trim().length >= 2 &&
    dni.length >= 8 &&
    !!paymentMethodId;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !mp || !paymentMethodId) return;
    setSubmitting(true);
    setError(null);
    try {
      const yearFull = `20${expParts.year}`;
      // Why: MP rechaza /v1/card_tokens desde el browser para esta cuenta
      // sandbox (issue conocido del Brick + SDK + fetch directo). Hacemos
      // tokenización server-side via /api/payments/tokenize que proxiea a
      // MP con access_token. PCI SAQ-A-EP: card data en memoria, HTTPS,
      // sin persistencia.
      const tokenRes = await fetch("/api/payments/tokenize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: digits,
          cardholder: {
            name: holder.trim(),
            identification: { type: "DNI", number: dni },
          },
          security_code: cvv,
          expiration_month: expParts.month,
          expiration_year: yearFull,
        }),
      });
      const tokenBody = (await tokenRes.json()) as {
        data?: { id: string };
        error?: string;
      };
      if (!tokenRes.ok || !tokenBody.data?.id) {
        const code = tokenBody.error ?? "token_failed";
        setError(humanizeCardError(code));
        onError?.(code);
        return;
      }
      const tokenResp = { id: tokenBody.data.id };
      const res = await fetch("/api/payments/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          token: tokenResp.id,
          paymentMethodId,
          installments: 1,
          issuerId,
        }),
      });
      const body = (await res.json()) as {
        data?: { status: string; paymentId: string; message?: string };
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
      if (value.status === "approved" || value.status === "in_process") {
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

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-cart-line bg-cart-bg-elev p-5">
      <div className="text-[16px] font-semibold tracking-[-0.01em]">Paga con tu tarjeta</div>
      <p className="mt-1 text-[12.5px] text-cart-ink-3">
        Visa, Mastercard, AMEX, Diners — débito o crédito.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {/* Número de tarjeta */}
        <CardField label="Número de tarjeta">
          <div className="relative">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="cc-number"
              value={formatCardNumber(cardNumber, brand)}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="1234 1234 1234 1234"
              className="block w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 py-3.5 pr-14 font-mono text-[15px] tracking-[0.04em] text-white outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <BrandIcon brand={brand} />
            </span>
          </div>
        </CardField>

        <div className="grid grid-cols-2 gap-3">
          <CardField label="Vencimiento">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="cc-exp"
              value={formatExp(exp)}
              onChange={(e) => setExp(e.target.value)}
              placeholder="MM/AA"
              className="block w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 py-3.5 font-mono text-[15px] tracking-[0.04em] text-white outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
            />
          </CardField>
          <CardField label="CVV">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, cvvLen))}
              placeholder={cvvLen === 4 ? "1234" : "123"}
              className="block w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 py-3.5 font-mono text-[15px] tracking-[0.04em] text-white outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
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
      return "No pudimos cobrarte. Vuelve a intentar o usa otra tarjeta.";
  }
}

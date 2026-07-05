"use client";

import { use } from "react";
import { useRouter } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { unitsRemaining } from "@/lib/events/ticketDisplay";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ reason?: string }>;
};

type ReasonInfo = {
  title: string;
  body: string;
  /** Nota contextual debajo. Si es null, no se muestra el bloque. */
  note: string | null;
  /** Si está definido, sobrescribe el comportamiento default de retry. */
  primaryCta?: { label: string; action: "retry" | "retry_no_promo" };
};

const YAPE_NOTE =
  "No se descuenta nada hasta que confirmes el pago. Si ya pagaste, espera unos segundos — a veces Yape demora.";

const REASON_MAP: Record<string, ReasonInfo> = {
  failed: {
    title: "No pudimos cobrarte",
    body: "El banco rechazó el pago. Intenta de nuevo o usa otro método.",
    note: YAPE_NOTE,
  },
  expired: {
    title: "El código expiró",
    body: "El código de Yape se venció antes de confirmarse. Pide uno nuevo.",
    note: YAPE_NOTE,
  },
  insufficient_funds: {
    title: "Saldo insuficiente",
    body: "Yape dice que no tienes saldo suficiente. Recarga e intenta de nuevo.",
    note: YAPE_NOTE,
  },
  self_purchase_blocked: {
    title: "Ese código es tuyo",
    body: "No puedes comprar con tu propio código de promotor — está pensado para que otras personas te apoyen. Si quieres una entrada, compra sin código.",
    note: null,
    primaryCta: { label: "Comprar sin tu código", action: "retry_no_promo" },
  },
  sold_out: {
    title: "Se acabaron",
    body: "Alguien se llevó la última entrada mientras pagabas. No se te cobró nada.",
    note: null,
  },
  guest_contact_required: {
    title: "Faltan datos",
    body: "Necesitamos tu WhatsApp o email para enviarte el QR.",
    note: null,
  },
  buy_failed: {
    title: "No pudimos completar tu pedido",
    body: "Algo falló de nuestro lado. No se te cobró nada — intenta de nuevo en unos segundos.",
    note: null,
  },
  in_review: {
    title: "Tu pago está en revisión",
    body: "Tu banco está validando el pago (a veces tarda un poco). Apenas lo confirme, te llega tu QR por correo y WhatsApp, y aparece en Mis entradas. No te preocupes: no se te cobró dos veces.",
    note: null,
  },
  unknown: {
    title: "No pudimos cobrarte",
    body: "Algo salió mal con el pago. Tu entrada no fue cobrada.",
    note: YAPE_NOTE,
  },
};

const fallback: ReasonInfo = REASON_MAP.unknown;

export default function BuyerPayErrorPage({ params, searchParams }: Props) {
  const { slug } = use(params);
  const sp = searchParams ? use(searchParams) : undefined;
  const router = useRouter();
  const { data } = useEvent(slug);

  const reasonKey = sp?.reason ?? "unknown";
  const info = REASON_MAP[reasonKey] ?? fallback;

  const remaining = data?.ticketTypes.reduce(
    (sum, tt) => sum + unitsRemaining(tt),
    0,
  ) ?? null;

  const retry = () => router.push(`/events/${slug}/buy` as never);
  const retryWithoutPromo = () => {
    // Limpia el promo guardado en localStorage para este slug, así no se
    // re-aplica al volver al buy. Sin esto el pivote silencioso vuelve a
    // disparar el mismo error.
    try {
      window.localStorage.removeItem(`pasape:promo:${slug}`);
    } catch {}
    router.push(`/events/${slug}/buy` as never);
  };
  const goEvent = () => router.push(`/events/${slug}` as never);

  const primaryAction = info.primaryCta?.action === "retry_no_promo" ? retryWithoutPromo : retry;
  const primaryLabel = info.primaryCta?.label ?? "Intentar de nuevo";

  return (
    <div className="min-h-dvh bg-cart-bg text-white">
      <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-5 py-3.5">
          <button
            type="button"
            onClick={goEvent}
            aria-label="Volver al evento"
            className="grid size-9 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[12.5px] text-cart-ink-3">Pago no confirmado</span>
          <span className="size-9" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[640px] flex-col px-5 pt-10 pb-36 lg:min-h-[calc(100dvh-72px)] lg:max-w-[460px] lg:items-stretch lg:justify-center lg:pb-12 lg:pt-0">
        <div className="lg:rounded-3xl lg:border lg:border-cart-line lg:bg-cart-bg-elev lg:p-8 lg:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
          <div className="grid size-16 place-items-center rounded-2xl border border-rose-500/40 bg-rose-500/10 shadow-[0_0_30px_-8px_rgba(255,77,94,0.4)]">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 7l14 14M21 7L7 21" stroke="#ff5d6e" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="mt-5 text-[28px] font-bold leading-[1.05] tracking-[-0.02em]">
            {info.title}
          </h1>
          <p className="mt-2 text-[14.5px] leading-[1.5] text-cart-ink-2">
            {info.body}
          </p>

          {info.note && (
            <div className="mt-6 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 lg:bg-cart-bg-elev-2">
              <div className="flex items-start gap-3">
                <span className="grid size-7 flex-shrink-0 place-items-center rounded-full bg-cart-accent-soft text-cart-accent">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 4v5M8 11.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </span>
                <div className="text-[13px] leading-[1.5] text-cart-ink-2">{info.note}</div>
              </div>
            </div>
          )}

          {remaining != null && remaining > 0 && remaining <= 20 && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <span className="size-2 animate-pulse rounded-full bg-amber-400" />
              <span className="text-[13px] text-amber-100">
                Quedan <strong className="text-white">{remaining} entradas</strong> — apúrate antes de que se agoten.
              </span>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-2.5 lg:mt-6">
            <button
              type="button"
              onClick={primaryAction}
              className="w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110"
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={goEvent}
              className="w-full rounded-full border border-cart-line bg-cart-bg-elev py-3 text-[14px] font-semibold text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white lg:bg-cart-bg-elev-2"
            >
              Volver al evento
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

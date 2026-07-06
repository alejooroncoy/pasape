"use client";

import { use } from "react";
import { useRouter } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { unitsRemaining } from "@/lib/events/ticketDisplay";
import { payErrorInfo, normalizeCheckoutErrorCode } from "@/lib/tickets/checkoutErrors";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ reason?: string }>;
};

export default function BuyerPayErrorPage({ params, searchParams }: Props) {
  const { slug } = use(params);
  const sp = searchParams ? use(searchParams) : undefined;
  const router = useRouter();
  const { data } = useEvent(slug);

  const reasonKey = normalizeCheckoutErrorCode(sp?.reason ?? "unknown");
  const info = payErrorInfo(reasonKey);

  const remaining = data?.ticketTypes.reduce(
    (sum, tt) => sum + unitsRemaining(tt),
    0,
  ) ?? null;

  const retry = () => router.push(`/events/${slug}/buy` as never);
  const retryWithoutPromo = () => {
    try {
      window.localStorage.removeItem(`pasape:promo:${slug}`);
    } catch {}
    router.push(`/events/${slug}/buy` as never);
  };
  const goEvent = () => router.push(`/events/${slug}` as never);

  const primaryAction =
    reasonKey === "in_review"
      ? goEvent
      : info.primaryCta?.action === "retry_no_promo"
        ? retryWithoutPromo
        : retry;
  const primaryLabel =
    reasonKey === "in_review"
      ? "Volver al evento"
      : info.primaryCta?.label ?? "Intentar de nuevo";

  const showRecover = reasonKey === "in_review" || reasonKey === "buy_failed" || reasonKey === "unknown";

  return (
    <div className="min-h-dvh bg-cart-bg text-white">
      <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-5 py-3.5">
          <button
            type="button"
            onClick={goEvent}
            className="text-[13px] font-medium text-cart-ink-3 transition hover:text-white"
          >
            ← Volver
          </button>
          <span className="text-[13px] font-semibold tracking-[-0.01em]">Pago</span>
          <span className="w-12" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-5 py-10 lg:py-14">
        <div className="mx-auto max-w-[400px] text-center lg:text-left">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-rose-500/15 lg:mx-0">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-rose-300">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="mt-5 text-[22px] font-bold tracking-[-0.02em] lg:text-[24px]">
            {info.title}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-cart-ink-2">{info.body}</p>
          {info.note && (
            <p className="mt-3 text-[13px] leading-relaxed text-cart-ink-3">{info.note}</p>
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
            {showRecover ? (
              <button
                type="button"
                onClick={() => router.push("/tickets/recover" as never)}
                className="w-full rounded-full border border-cart-line bg-cart-bg-elev py-3 text-[14px] font-semibold text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white lg:bg-cart-bg-elev-2"
              >
                Recuperar mis entradas
              </button>
            ) : (
              <button
                type="button"
                onClick={goEvent}
                className="w-full rounded-full border border-cart-line bg-cart-bg-elev py-3 text-[14.5px] font-semibold text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white lg:bg-cart-bg-elev-2"
              >
                Volver al evento
              </button>
            )}
          </div>
          {showRecover && (
            <p className="mt-4 text-center text-[12px] text-cart-ink-4 lg:text-left">
              Si ya pagaste, tu QR puede tardar unos segundos en aparecer.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

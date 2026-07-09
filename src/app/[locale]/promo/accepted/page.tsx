"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useMyPromoterLinks } from "@/lib/promoters/hooks/usePromoter";
import { useRouter } from "@/i18n/navigation";

// Confetti sutil: puntos de color fijos con pulso escalonado.
const SPARKS: Array<{ left: string; top: string; color: string; delay: number }> = [
  { left: "12%", top: "18%", color: "var(--color-cart-accent)", delay: 0 },
  { left: "82%", top: "22%", color: "var(--color-success)", delay: 0.2 },
  { left: "18%", top: "72%", color: "var(--color-warning)", delay: 0.5 },
  { left: "82%", top: "68%", color: "var(--color-danger)", delay: 0.3 },
  { left: "50%", top: "12%", color: "#fff", delay: 0.6 },
];

export default function PromoAcceptedCelebratePage() {
  const links = useMyPromoterLinks();
  const first = links.data?.[0];
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const origin =
    typeof window === "undefined" ? "" : window.location.origin.replace(/^https?:\/\//, "");
  const shareUrl = first
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${first.code}`
    : "";

  const onCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (links.isLoading) {
    return (
      <Shell>
        <p className="px-1 py-8 text-[14px] text-cart-ink-3">Preparando tu link de venta…</p>
      </Shell>
    );
  }

  return (
    <div className="bg-cart-bg text-white lg:grid lg:min-h-dvh lg:place-items-center lg:p-8">
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-cart-bg text-white lg:min-h-[560px] lg:w-full lg:max-w-[540px] lg:rounded-3xl lg:border lg:border-cart-line lg:bg-cart-bg-elev/30 lg:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[440px]"
          style={{ background: "radial-gradient(70% 55% at 50% 25%, rgba(184,124,255,0.4), transparent 70%)" }}
        />
        {SPARKS.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute size-1.5 rounded-full"
            style={{
              left: s.left,
              top: s.top,
              background: s.color,
              boxShadow: `0 0 12px ${s.color}`,
              animation: "pulse 1.6s ease-in-out infinite",
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

        <div className="relative z-[1] flex justify-end px-5 pt-4">
          <button
            type="button"
            onClick={() => router.push("/promo" as never)}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <main className="relative z-[1] mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center px-5 pb-8 text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="grid size-[104px] place-items-center rounded-[30px]"
            style={{
              background: "linear-gradient(135deg, #B084FF, #A855F7 60%, #7C3AED)",
              boxShadow: "0 26px 54px -12px rgba(168,85,247,0.65), 0 0 0 6px rgba(168,85,247,0.15)",
            }}
          >
            <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
              <path d="M10 24l10 10L38 14" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>

          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-cart-accent">
            ◆ Estás dentro
          </p>
          <h1 className="mt-2.5 text-[30px] font-bold leading-none tracking-[-0.03em]">¡Te aprobaron!</h1>
          {first ? (
            <p className="mt-3.5 max-w-[300px] text-[14px] leading-relaxed text-cart-ink-3">
              Ya eres promotor oficial de <strong className="text-white">{first.eventTitle}</strong>.
            </p>
          ) : (
            <p className="mt-3.5 max-w-[300px] text-[14px] leading-relaxed text-cart-ink-3">
              Tu cuenta de promotor ya está activa.
            </p>
          )}

          {first && (
            <>
              <div className="mt-6 rounded-2xl border border-cart-line bg-black/40 px-5 py-3.5 font-mono text-[13px] font-semibold">
                {origin}/r/<span className="text-cart-accent">{first.code}</span>
              </div>
              <button
                type="button"
                onClick={() => void onCopy()}
                className={`mt-3 text-[12px] font-semibold transition ${copied ? "text-emerald-400" : "text-cart-ink-3 hover:text-white"}`}
              >
                {copied ? "✓ Link copiado" : "Copiar link de venta"}
              </button>
            </>
          )}
        </main>

        <div className="relative z-[1] mx-auto w-full max-w-[440px] px-5 pb-6">
          <button
            type="button"
            onClick={() => router.push("/promo" as never)}
            className="w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110"
          >
            Ver mi panel de promotor →
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cart-bg text-white">
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5">{children}</main>
    </div>
  );
}

"use client";

import { use, useEffect } from "react";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { useResolveInvite, useApplicationStatus, useRealtimePromoterApplications } from "@/lib/promoters/hooks/usePromoter";

type Props = { params: Promise<{ token: string }> };

export default function PromoAppliedWaitingPage({ params }: Props) {
  const { token } = use(params);
  const resolved = useResolveInvite(token);
  const status = useApplicationStatus(resolved.data?.eventSlug ?? "");
  useRealtimePromoterApplications(resolved.data?.eventSlug ?? "");
  const router = useRouter();

  useEffect(() => {
    if (status.data?.status === "approved") {
      router.replace("/promo/accepted" as never);
    }
  }, [status.data?.status, router]);

  if (resolved.isLoading) {
    return (
      <Shell>
        <p className="px-1 py-8 text-[14px] text-cart-ink-3">Verificando tu solicitud…</p>
      </Shell>
    );
  }

  if (resolved.error || !resolved.data) {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-rose-500/15 text-rose-300">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v5M12 16.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
          <h1 className="mt-4 text-[20px] font-bold tracking-[-0.02em]">Invitación no válida</h1>
          <p className="mt-2 max-w-[280px] text-[13.5px] leading-relaxed text-cart-ink-3">
            Si ya enviaste tu postulación, espera el WhatsApp del organizador.
          </p>
          <button
            type="button"
            onClick={() => router.push("/" as never)}
            className="mt-6 py-2.5 text-[13.5px] font-medium text-cart-ink-3 transition hover:text-white"
          >
            Volver a inicio
          </button>
        </div>
      </Shell>
    );
  }

  // "rejected"/"cancelled" no tienen pantalla de destino propia (a diferencia
  // de approved → /promo/accepted): sin este chequeo el postulante rechazado
  // se queda viendo "en revisión" para siempre, esperando un WhatsApp que
  // nunca llega.
  const isClosedOut = status.data?.status === "rejected" || status.data?.status === "cancelled";

  return (
    <div className="bg-cart-bg text-white lg:grid lg:min-h-dvh lg:place-items-center lg:p-8">
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-cart-bg text-white lg:min-h-[560px] lg:w-full lg:max-w-[540px] lg:rounded-3xl lg:border lg:border-cart-line lg:bg-cart-bg-elev/30 lg:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{
            background: isClosedOut
              ? "radial-gradient(70% 55% at 50% 25%, rgba(94,94,112,0.22), transparent 70%)"
              : "radial-gradient(70% 55% at 50% 25%, rgba(255,206,59,0.16), transparent 70%)",
          }}
        />

        <div className="relative z-[1] flex justify-end px-5 pt-4">
          <CloseButton onClick={() => router.push("/" as never)} />
        </div>

        <main className="relative z-[1] mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center justify-center px-5 pb-10 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
            className="grid size-[104px] place-items-center rounded-[32px]"
            style={{
              background: isClosedOut
                ? "linear-gradient(135deg, #6B7280, #4B5563)"
                : "linear-gradient(135deg, #FFCE3B, #FF9B3B)",
              boxShadow: isClosedOut
                ? "0 26px 54px -12px rgba(75,85,99,0.5), 0 0 0 6px rgba(107,114,128,0.12)"
                : "0 26px 54px -12px rgba(255,206,59,0.5), 0 0 0 6px rgba(255,206,59,0.12)",
            }}
          >
            {isClosedOut ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-black/80">
                <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            ) : (
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-3 rounded-full bg-[#1a1200]"
                    style={{ animation: "pulse 1.4s ease-in-out infinite", animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            )}
          </motion.div>

          {isClosedOut ? (
            <>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-cart-ink-3">
                ◆ Solicitud cerrada
              </p>
              <h1 className="mt-2.5 text-[27px] font-bold leading-[1.05] tracking-[-0.03em]">
                El organizador no aprobó tu solicitud esta vez.
              </h1>
              <p className="mt-3.5 max-w-[300px] text-[14px] leading-relaxed text-cart-ink-3">
                No te va a llegar el link de venta para este evento. Puedes postular a otro evento cuando quieras.
              </p>
            </>
          ) : (
            <>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
                ◆ En espera
              </p>
              <h1 className="mt-2.5 text-[27px] font-bold leading-[1.05] tracking-[-0.03em]">
                Tu solicitud ya está en revisión.
              </h1>
              <p className="mt-3.5 max-w-[300px] text-[14px] leading-relaxed text-cart-ink-3">
                En cuanto te aprueben, vas a poder vender desde el panel de promotor con tu link único.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/6 px-4 py-2.5 text-[12px] text-cart-ink-3">
                <span className="size-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_var(--color-warning)]" />
                Suele responder en 1-2 horas
              </div>
            </>
          )}
        </main>

        <div className="relative z-[1] mx-auto w-full max-w-[440px] px-5 pb-6 text-center">
          <button
            type="button"
            onClick={() => router.push("/" as never)}
            className="py-2.5 text-[13.5px] font-medium text-cart-ink-3 transition hover:text-white"
          >
            Volver a inicio
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

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Cerrar"
      className="grid size-9 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

"use client";

import { use, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { useClaimTransfer } from "@/lib/tickets/hooks/useTickets";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { Logo } from "@/components/brand/Logo";

type Props = { params: Promise<{ token: string }> };

export default function ClaimPage(props: Props) {
  const { token } = use(props.params);
  const me = useCurrentUser();
  const claim = useClaimTransfer();
  const router = useRouter();
  const ranRef = useRef(false);
  const [done, setDone] = useState<{ ticketId: string } | null>(null);

  const isLogged = !!me.data?.user;

  // Logueado → reclamamos automáticamente una sola vez ("pase automático").
  useEffect(() => {
    if (!isLogged || ranRef.current) return;
    ranRef.current = true;
    claim
      .mutateAsync({ token })
      .then((res) => setDone({ ticketId: res.ticketId }))
      .catch(() => {
        /* el error se muestra abajo */
      });
  }, [isLogged, token, claim]);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-cart-bg px-6 py-12 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124,58,237,0.28), rgba(124,58,237,0.06) 55%, transparent 75%)",
          filter: "blur(20px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px] text-center"
      >
        <div className="mb-6 inline-flex flex-col items-center">
          <div
            aria-hidden
            className="grid size-14 place-items-center rounded-[18px] bg-cart-bg-elev shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_20px_50px_-12px_rgba(124,58,237,0.45)]"
          >
            <Logo className="size-8" />
          </div>
        </div>

        {/* Cargando sesión */}
        {me.isLoading ? (
          <p className="text-[14px] text-cart-ink-3">Cargando…</p>
        ) : !isLogged ? (
          /* No logueado: entra para reclamar */
          <>
            <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-cart-accent-soft text-cart-accent">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M21 8.5l-9 5-9-5M3 8l9-5 9 5v8l-9 5-9-5V8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-[26px] font-bold tracking-[-0.02em]">Tienes una entrada esperándote</h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-[13.5px] leading-snug text-cart-ink-3">
              Entra con tu cuenta para que la entrada quede guardada en tu wallet, con tu propio QR.
            </p>
            <button
              type="button"
              onClick={() => {
                const next = encodeURIComponent(window.location.pathname);
                router.push(`/login?next=${next}` as never);
              }}
              className="mt-7 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110"
            >
              Entrar para reclamarla
            </button>
          </>
        ) : done ? (
          /* Éxito */
          <>
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-emerald-400/15"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-emerald-300">
                <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
            <h1 className="text-[26px] font-bold tracking-[-0.02em]">¡La entrada ya es tuya!</h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-[13.5px] leading-snug text-cart-ink-3">
              La guardamos en tu wallet con tu propio QR. Muéstralo en la puerta.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/tickets/${done.ticketId}` as never)}
              className="mt-7 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110"
            >
              Ver mi entrada
            </button>
          </>
        ) : claim.isPending || (!claim.error && !done) ? (
          /* Reclamando */
          <p className="text-[14px] text-cart-ink-3">Reclamando tu entrada…</p>
        ) : (
          /* Error */
          <>
            <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-rose-500/15 text-rose-300">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 7.5v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-[22px] font-bold tracking-[-0.02em]">No pudimos darte la entrada</h1>
            <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-snug text-cart-ink-3">
              {claimErrorCopy((claim.error as Error | null)?.message ?? "")}
            </p>
            <button
              type="button"
              onClick={() => router.push("/tickets" as never)}
              className="mt-7 w-full rounded-full bg-cart-bg-elev py-3.5 text-[14px] font-semibold text-white transition hover:bg-cart-bg-elev-2"
            >
              Ir a mis entradas
            </button>
          </>
        )}
      </motion.div>
    </main>
  );
}

function claimErrorCopy(raw: string): string {
  switch (raw) {
    case "claim_not_found":
      return "Este enlace ya no es válido. Quizá la entrada ya se reclamó o el envío se canceló.";
    case "claim_expired":
      return "El enlace venció. Pídele a quien te la envió que te la mande de nuevo.";
    case "cannot_claim_own":
      return "Esta entrada ya es tuya — la enviaste tú mismo.";
    case "ticket_not_active":
      return "Esta entrada ya no está activa (usada o anulada).";
    case "claim_no_longer_valid":
      return "El envío ya no es válido. Pídele a quien te la envió que te la mande de nuevo.";
    default:
      return "Algo salió mal. Inténtalo de nuevo más tarde.";
  }
}

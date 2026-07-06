"use client";

import { use, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { useClaimTransfer } from "@/lib/tickets/hooks/useTickets";
import { sanitizeDocument, sanitizePersonName } from "@/lib/input/sanitize";
import { isValidDocument } from "@/lib/identity/document";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { GoogleBtn } from "@/components/design";
import { setOauthReturn } from "@/components/auth/PostLoginRedirect";
import { Logo } from "@/components/brand/Logo";

type Props = { params: Promise<{ token: string }> };

export default function ClaimPage(props: Props) {
  const { token } = use(props.params);
  const me = useCurrentUser();
  const claim = useClaimTransfer();
  const router = useRouter();
  // Google directo (sin /login, que desvía al panel de organizador). El token va
  // en la ruta, así que vuelve intacto del OAuth.
  const google = useGoogleSignIn({});
  const [done, setDone] = useState<{ ticketId: string } | null>(null);

  const isLogged = !!me.data?.user;
  const profileName = me.data?.user?.fullName ?? "";
  const profileDni = me.data?.user?.dni ?? "";

  // Confirmación de identidad del holder real: si el perfil ya tiene nombre/DNI,
  // autorrellenamos y el receptor solo confirma; si no, los pide. No hay "pase
  // automático" — capturamos quién va a entrar antes de reclamar.
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [isForeigner, setIsForeigner] = useState(false);
  const [touched, setTouched] = useState(false);
  const claimInFlightRef = useRef(false);

  // Hidratar los campos con los datos del perfil una vez carga la sesión.
  useEffect(() => {
    if (!isLogged) return;
    setName((n) => (n === "" ? profileName : n));
    setDni((d) => (d === "" ? profileDni : d));
  }, [isLogged, profileName, profileDni]);

  const nameValid = name.trim().length >= 2;
  const dniValid = isValidDocument(dni, isForeigner);
  const canSubmit = isLogged && nameValid && dniValid && !claim.isPending;

  const submit = () => {
    setTouched(true);
    if (!isLogged || !nameValid || !dniValid || claim.isPending || claimInFlightRef.current) return;
    claimInFlightRef.current = true;
    claim
      .mutateAsync({ token, fullName: name.trim(), dni, isForeigner })
      .then((res) => setDone({ ticketId: res.ticketId }))
      .catch(() => {
        /* el error se muestra abajo */
      })
      .finally(() => {
        claimInFlightRef.current = false;
      });
  };

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
            <div className="mt-7">
              <GoogleBtn
                onClick={() => {
                  setOauthReturn(window.location.pathname + window.location.search);
                  google.signIn();
                }}
                disabled={google.pending}
                label={google.pending ? "Abriendo Google…" : "Continuar con Google"}
              />
            </div>
            {google.error && (
              <p className="mt-3 text-[12px] text-rose-300">No se pudo abrir Google. Reintenta.</p>
            )}
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
        ) : (
          /* Confirmación de identidad → reclamar */
          <>
            <h1 className="text-[24px] font-bold tracking-[-0.02em]">Confirma tus datos</h1>
            <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-snug text-cart-ink-3">
              Esta entrada es nominativa. El portero verifica tu DNI en la puerta — confirma con qué nombre y documento vas a entrar.
            </p>

            <div className="mt-6 space-y-3 text-left">
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-cart-ink-3">Nombre completo</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(sanitizePersonName(e.target.value))}
                  placeholder="Tu nombre y apellido"
                  className="w-full rounded-xl border border-white/10 bg-cart-bg-elev px-3.5 py-3 text-[14.5px] text-white placeholder:text-cart-ink-3 focus:border-cart-accent focus:outline-none"
                />
                {touched && !nameValid && (
                  <p className="mt-1 text-[11px] text-red-400">Ingresa tu nombre completo.</p>
                )}
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-cart-ink-2">
                <input
                  type="checkbox"
                  checked={isForeigner}
                  onChange={(e) => setIsForeigner(e.target.checked)}
                  className="h-4 w-4 accent-cart-accent"
                />
                Soy extranjero (no tengo DNI)
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-cart-ink-3">
                  {isForeigner ? "Pasaporte / documento" : "DNI"}
                </span>
                <input
                  type="text"
                  inputMode={isForeigner ? "text" : "numeric"}
                  maxLength={isForeigner ? 20 : 8}
                  value={dni}
                  onChange={(e) => setDni(sanitizeDocument(e.target.value, isForeigner))}
                  placeholder={isForeigner ? "AB123456" : "8 dígitos"}
                  className="w-full rounded-xl border border-white/10 bg-cart-bg-elev px-3.5 py-3 text-[14.5px] tracking-[0.08em] text-white placeholder:text-cart-ink-3 placeholder:tracking-normal focus:border-cart-accent focus:outline-none"
                />
                {touched && !dniValid && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {isForeigner ? "Ingresa tu documento." : "El DNI debe tener 8 dígitos."}
                  </p>
                )}
              </label>
            </div>

            {claim.isError && (
              <p className="mt-3 text-[12px] text-rose-300">
                {claimErrorCopy((claim.error as Error | null)?.message ?? "")}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="mt-6 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {claim.isPending ? "Reclamando…" : "Confirmar y reclamar"}
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

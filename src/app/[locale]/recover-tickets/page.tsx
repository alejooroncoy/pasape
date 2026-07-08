"use client";

// Why: piloto usa OTP "mock" para recuperar tickets perdidos. El código
// se loguea en consola del servidor (y se devuelve en `devCode` en dev)
// para evitar wirear SMS/email infra antes de validar la UX.

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CloseBtn, FONT_MONO, OtpRow, StepDots } from "@/components/design";
import { Logo } from "@/components/brand/Logo";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/_shared/api-client";

// Puntos de reaseguro del panel de marca (desktop) — la razón real de que
// esta pantalla exista: que perder el WhatsApp no signifique perder la
// entrada.
const REASSURANCES = [
  "Tu QR queda ligado a tu correo, no a un solo mensaje de WhatsApp.",
  "El código de recuperación llega en segundos.",
  "Nadie más puede reclamar tu entrada sin ese código.",
];

// Recuperación solo por correo: hoy no hay proveedor de SMS/WhatsApp OTP
// contratado (ver research de costo — Twilio/WhatsApp Business API), así que
// pedir "celular" sería ofrecer una vía que no puede entregar el código de
// verdad.
const isEmailValid = (s: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

type StartResp = { devCode?: string };
type VerifyResp = {
  profileId: string | null;
  tickets: Array<{ id: string; event: { title: string } }>;
  orderLinks: Array<{ orderId: string; token: string }>;
};

// Milisegundos de espera antes de llevar al usuario al link de la orden encontrada. El perfil que
// resuelve el OTP es un guest sin sesión — por eso NO vamos a /tickets
// (exige login y mostraría la wallet vacía de otra cuenta). En vez de eso,
// aterrizamos en /order/[id]/[token]: la misma ruta que usa la entrega por
// WhatsApp, que pide login y luego reclama la compra a la cuenta logueada.
const REDIRECT_DELAY_MS = 1200;

export default function TicketRecoverPage() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResp | null>(null);

  const sendCode = async () => {
    setError(null);
    setPending(true);
    try {
      const data = await api.post<StartResp>("/api/tickets/recover/start", { identifier });
      setDevCode(data.devCode ?? null);
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const verify = async () => {
    setError(null);
    setPending(true);
    try {
      const data = await api.post<VerifyResp>("/api/tickets/recover/verify", {
        identifier,
        code,
      });
      setResult(data);
      const firstLink = data.orderLinks[0];
      if (firstLink) {
        // Mostramos el resultado inline para feedback inmediato y luego
        // llevamos a la orden encontrada: ahí el login SÍ reclama la compra
        // (claimOrder) en vez de rebotar a una wallet vacía.
        setTimeout(
          () =>
            router.replace(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              `/order/${firstLink.orderId}/${firstLink.token}` as any,
            ),
          REDIRECT_DELAY_MS,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-cart-bg text-white lg:grid lg:grid-cols-2">
      {/* Panel de marca — solo desktop. En mobile este flujo ya vive centrado
          y compacto (abajo); acá le damos al recover el mismo peso visual
          que el resto del checkout en pantallas grandes, en vez de dejarlo
          como un card chico flotando en medio de una pantalla vacía. */}
      <div
        aria-hidden
        className="relative hidden overflow-hidden border-r border-cart-line bg-cart-bg-elev lg:flex lg:flex-col lg:items-start lg:justify-between lg:p-14"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div
          className="pointer-events-none absolute -left-32 -top-32 size-[520px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(124,58,237,0.35), transparent 72%)",
            filter: "blur(30px)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-40 -right-24 size-[460px] rounded-full"
          style={{
            background: "radial-gradient(closest-side, rgba(255,77,94,0.22), transparent 72%)",
            filter: "blur(40px)",
          }}
        />

        <div className="relative z-10 inline-flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-[14px] bg-cart-bg shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]">
            <Logo className="size-6" />
          </div>
          <span className="font-sans text-[15px] font-semibold tracking-[-0.01em]">Pasape</span>
        </div>

        <div className="relative z-10 max-w-[360px]">
          <h2 className="text-balance font-sans text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
            Tu entrada, siempre recuperable.
          </h2>
          <ul className="mt-7 flex flex-col gap-4">
            {REASSURANCES.map((line) => (
              <li key={line} className="flex items-start gap-3 text-[13.5px] leading-snug text-cart-ink-3">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="mt-0.5 shrink-0 text-cart-accent"
                  aria-hidden
                >
                  <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M5 8.2l2 2 4-4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-[11.5px] text-cart-ink-4">
          ¿Recién compraste? El QR también llega directo a tu WhatsApp.
        </div>
      </div>

      {/* Columna del formulario */}
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-12">
        {/* Decoración: un solo fade suave (sin parada intermedia — esa era la
            que generaba el anillo/borde duro tipo "ícono de app" al hacerle
            blur) y descentrado, para que se sienta ambiental y no como un
            spotlight redondo pegado al centro. En desktop el panel de marca
            ya aporta la atmósfera, así que acá va bien tenue. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-1/3 -right-1/4 size-[900px] rounded-full lg:size-[720px]"
          style={{
            background: "radial-gradient(circle, rgba(124,58,237,0.16), transparent 70%)",
            filter: "blur(80px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 size-[420px] translate-x-1/3 translate-y-1/3 rounded-full lg:hidden"
          style={{
            background: "radial-gradient(circle, rgba(255,77,94,0.14), transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        <div className="relative z-10 flex w-full max-w-[400px] flex-col items-center">
          <div className="mb-8 flex w-full items-center justify-between">
          <button
            type="button"
            aria-label="Volver"
            onClick={() => (step === 1 ? setStep(0) : router.back())}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <StepDots step={step} of={2} />
          <CloseBtn />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 0 ? (
            <motion.div
              key="identify"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full text-center"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cart-accent">
                Recuperar entradas
              </div>
              <h1 className="mt-2 text-balance font-sans text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[32px]">
                ¿Perdiste tu QR?
              </h1>
              <p className="mx-auto mt-2.5 max-w-[32ch] text-[13.5px] leading-snug text-cart-ink-3">
                Ingresa el correo que usaste para comprar. Te mandamos un código de 6 dígitos.
              </p>

              <div className="mt-8 text-left">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3">
                  Email
                </label>
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="juan@gmail.com"
                  className="w-full rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3.5 text-[15px] font-medium text-white placeholder:text-cart-ink-4 outline-none transition focus:border-cart-accent focus:ring-4 focus:ring-cart-accent-soft"
                />
              </div>

              {error && <p className="mt-3 text-[12.5px] text-rose-300">{error}</p>}

              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={pending || !isEmailValid(identifier)}
                className="mt-6 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
              >
                {pending ? "Enviando…" : "Enviar código →"}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="verify"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full text-center"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cart-accent">
                Paso 2 de 2
              </div>
              <h1 className="mt-2 text-balance font-sans text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[32px]">
                Código de recuperación
              </h1>
              <p className="mx-auto mt-2.5 max-w-[32ch] text-[13.5px] leading-snug text-cart-ink-3">
                Mandamos un código a{" "}
                <span className="font-semibold text-cart-ink-2">{identifier}</span>.{" "}
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="font-semibold text-cart-accent underline underline-offset-2 hover:text-white"
                >
                  Editar
                </button>
              </p>

              <div className="mt-8">
                <OtpRow value={code} onChange={setCode} />
              </div>

              {devCode && (
                <p className="mt-3 font-mono text-[12px] text-cart-ink-4" style={{ fontFamily: FONT_MONO }}>
                  dev code: {devCode}
                </p>
              )}

              {error && <p className="mt-3 text-[12.5px] text-rose-300">{error}</p>}

              {result && (
                <div className="mt-4 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3 text-[13px] text-cart-ink-2">
                  {result.tickets.length === 0
                    ? "No encontramos entradas activas con esos datos."
                    : `Encontramos ${result.tickets.length} entrada(s). Llevándote a tus tickets…`}
                </div>
              )}

              <button
                type="button"
                onClick={() => void verify()}
                disabled={pending || code.length !== 6}
                className="mt-6 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
              >
                {pending ? "Verificando…" : "Recuperar mis tickets →"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

"use client";

import { use, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { useClaimOrder } from "@/lib/tickets/hooks/useTickets";
import { useSessionReady } from "@/lib/identity/hooks/useSessionReady";
import { useUpdateProfile } from "@/lib/identity/hooks/useUpdateProfile";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { PhoneField } from "@/components/design/PhoneField";
import { GoogleBtn } from "@/components/design";
import { setOauthReturn } from "@/components/auth/PostLoginRedirect";
import { Logo } from "@/components/brand/Logo";
import { getCachedClaim, saveClaim } from "@/lib/tickets/claimedOrderStore";

// El token va en la RUTA (no en query): así sobrevive intacto al ida-y-vuelta del
// OAuth de Google (un ?k= se perdía como query anidado en el redirect_to).
type Props = { params: Promise<{ orderId: string; token: string }> };

// Link durable a tu orden: decide a dónde mandarte según su estado. Ya
// reclamada en este device → directo al ticket (offline-capable). Logueado
// sin reclamar → claimOrder engancha la compra a tu cuenta automáticamente.
// Sin sesión → "ya pagaste, entra para guardar tus entradas" con Google.
export default function OrderPage(props: Props) {
  const { orderId, token } = use(props.params);
  const { me, sessionReady, loggedIn: isLogged } = useSessionReady();
  const { mutateAsync: claimOrder, isError: claimIsError, error: claimError } = useClaimOrder();
  const claimOrderRef = useRef(claimOrder);
  claimOrderRef.current = claimOrder;
  const router = useRouter();
  const google = useGoogleSignIn({});
  const [done, setDone] = useState<{ count: number; firstId: string | null; eventSlug: string } | null>(null);
  const tried = useRef(false);

  // Justo al volver de Google, el snapshot de sesión persistido (para que la
  // app cargue rápido/offline) responde "no logueado" al instante, antes de
  // que el fetch fresco confirme que sí lo estás — eso hacía parpadear
  // "Entra para ver tus entradas" un instante tras loguearte. Mientras haya
  // un fetch en curso Y el resultado actual diga "no logueado", no lo
  // mostramos todavía: puede cambiar en cuanto llegue el dato real.
  const identityUnsettled = !sessionReady || (me.isFetching && !isLogged);

  const goToWallet = () => {
    if (done && done.count > 1) {
      router.replace(`/events/${done.eventSlug}/done?order=${orderId}&n=${done.count}` as never);
      return;
    }
    if (done?.count === 1 && done.firstId) router.push(`/tickets/${done.firstId}` as never);
    else router.push("/tickets" as never);
  };

  // Al cerrar sesión en esta página, limpiamos el estado del claim anterior.
  useEffect(() => {
    if (isLogged) return;
    setDone(null);
    tried.current = false;
  }, [isLogged]);

  // Captura de celular DESPUÉS del claim (el orden que pidió el fundador: primero
  // el tap con Google, luego el número para WhatsApp). Opcional y salteable: no
  // bloquea ver tus entradas. El DNI/nombre se piden recién al repartir.
  const update = useUpdateProfile();
  const [phone, setPhone] = useState("");
  const [phoneSkipped, setPhoneSkipped] = useState(false);
  const hasPhone = !!me.data?.user?.phone;
  // Tras el claim, `me` se refresca (el claim pudo copiar el teléfono de la orden
  // al profile). Mientras ese refetch está en curso no decidimos pedir el número:
  // evita el parpadeo de "Déjanos tu número" si en realidad ya lo tenemos.
  const needPhone = !!done && !hasPhone && !phoneSkipped && !me.isFetching;
  // `phone` ya viene en E.164 del PhoneField (país + número); el +51 se elige en
  // el selector, no se hardcodea aquí.
  const phoneOk = phone.length >= 9;
  const savePhone = () => {
    if (!phoneOk) return;
    update.mutate({ phone }, { onSettled: goToWallet });
  };

  // Logueado → reclamar automáticamente. Si la orden sigue `pending` (carrera con
  // el webhook de pago), reintentar cada 2s hasta que confirme.
  //
  // Antes de llamar al server, chequeamos si este device ya reclamó esta orden
  // (cache local en IndexedDB, ver claimedOrderStore). El claim es una mutación
  // POST — el Service Worker solo cachea GET — así que sin ese atajo, reabrir el
  // link de WhatsApp sin señal (típico en la puerta del venue) dejaría a la
  // persona colgada antes de llegar a ver su ticket, aunque ya sea 100% suyo y
  // el QR ya sea offline-capable. Solo el primer reclamo de cada persona
  // necesita red.
  useEffect(() => {
    if (!sessionReady || !isLogged || !token || done) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const run = () => {
      claimOrderRef
        .current({ orderId, token })
        .then((res) => {
          if (cancelled) return;
          void saveClaim(orderId, {
            ticketsClaimed: res.ticketsClaimed,
            firstTicketId: res.firstTicketId,
            eventSlug: res.eventSlug,
          });
          setDone({
            count: res.ticketsClaimed,
            firstId: res.firstTicketId,
            eventSlug: res.eventSlug,
          });
        })
        .catch((e) => {
          if (cancelled) return;
          const msg = (e as Error)?.message;
          if (msg === "order_not_paid") {
            timer = setTimeout(run, 2000);
            return;
          }
          // Permite reintentar si el usuario vuelve a entrar tras un error transitorio.
          tried.current = false;
        });
    };

    if (!tried.current) {
      tried.current = true;
      getCachedClaim(orderId).then((cached) => {
        if (cancelled) return;
        if (cached) {
          setDone({ count: cached.ticketsClaimed, firstId: cached.firstTicketId, eventSlug: cached.eventSlug });
          return;
        }
        run();
      });
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionReady, isLogged, token, done, orderId]);

  // Tras guardar las entradas, llevar al reparto o al wallet sin otro tap.
  useEffect(() => {
    if (!done || needPhone) return;
    const t = setTimeout(() => goToWallet(), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, needPhone]);

  const errorMsg = claimIsError ? unlockErrorCopy((claimError as Error | null)?.message ?? "") : null;
  const waitingPayment = (claimError as Error | null)?.message === "order_not_paid";

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

        {!token ? (
          <>
            <h1 className="text-[24px] font-bold tracking-[-0.02em]">Enlace inválido</h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-[13.5px] leading-snug text-cart-ink-3">
              Abre el enlace que te llegó al pagar, completo.
            </p>
          </>
        ) : identityUnsettled ? (
          <p className="text-[14px] text-cart-ink-3">Cargando…</p>
        ) : !isLogged ? (
          /* Pagado, falta entrar */
          <>
            <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-emerald-300">Pago confirmado</p>
            <h1 className="mt-1 text-[26px] font-bold tracking-[-0.02em]">Entra para ver tus entradas</h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-[13.5px] leading-snug text-cart-ink-3">
              Las guardamos en tu cuenta, con tu propio QR. Así las tienes siempre a la mano y puedes repartirlas.
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
        ) : needPhone ? (
          /* Tras el claim: pedimos el celular (para WhatsApp). Salteable. */
          <>
            <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-[24px] font-bold tracking-[-0.02em]">
              {done!.count === 1 ? "¡Entrada guardada!" : `¡${done!.count} entradas guardadas!`}
            </h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-[13.5px] leading-snug text-cart-ink-3">
              Déjanos tu número para enviártelas por WhatsApp y que las recuperes fácil.
            </p>
            <div className="mt-5 text-left">
              <PhoneField value={phone} onChange={setPhone} autoFocus />
            </div>
            <button
              type="button"
              onClick={savePhone}
              disabled={!phoneOk || update.isPending}
              className="mt-5 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {update.isPending ? "Guardando…" : "Guardar y ver mis entradas"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhoneSkipped(true);
                goToWallet();
              }}
              className="mt-3 text-[13px] font-medium text-cart-ink-3 transition hover:text-white"
            >
              Ahora no
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
            <h1 className="text-[26px] font-bold tracking-[-0.02em]">
              {done.count === 1 ? "¡Tu entrada está lista!" : `¡Tus ${done.count} entradas están listas!`}
            </h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-[13.5px] leading-snug text-cart-ink-3">
              {done.count === 1
                ? "La guardamos en tu cuenta con tu propio QR."
                : "Las guardamos en tu cuenta. Una es tuya; a las demás ponles nombre o repártelas por WhatsApp."}
            </p>
            <button
              type="button"
              onClick={goToWallet}
              className="mt-7 w-full rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110"
            >
              Ver mis entradas
            </button>
          </>
        ) : waitingPayment ? (
          /* Pago aún confirmándose */
          <>
            <motion.div
              aria-hidden
              className="mx-auto mb-5 size-9 rounded-full border-2 border-cart-accent/30 border-t-cart-accent"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: "linear", duration: 0.8 }}
            />
            <h1 className="text-[22px] font-bold tracking-[-0.02em]">Confirmando tu pago…</h1>
            <p className="mx-auto mt-2 max-w-[32ch] text-[13.5px] leading-snug text-cart-ink-3">
              Un segundo, estamos guardando tus entradas.
            </p>
          </>
        ) : errorMsg ? (
          <>
            <h1 className="text-[24px] font-bold tracking-[-0.02em]">No pudimos guardarlas</h1>
            <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-snug text-cart-ink-3">{errorMsg}</p>
            <button
              type="button"
              onClick={() => router.push("/tickets" as never)}
              className="mt-6 text-[13px] font-semibold text-cart-accent underline"
            >
              Ir a mis entradas
            </button>
          </>
        ) : (
          /* Reclamando */
          <>
            <motion.div
              aria-hidden
              className="mx-auto mb-5 size-9 rounded-full border-2 border-cart-accent/30 border-t-cart-accent"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: "linear", duration: 0.8 }}
            />
            <h1 className="text-[22px] font-bold tracking-[-0.02em]">Guardando tus entradas…</h1>
          </>
        )}
      </motion.div>
    </main>
  );
}

function unlockErrorCopy(raw: string): string {
  switch (raw) {
    case "order_already_claimed":
      return "Estas entradas ya se guardaron en otra cuenta. Si fuiste tú, entra con esa cuenta.";
    case "order_claim_expired":
      return "El enlace para guardar esta compra venció. Recupera tus entradas desde “Mis entradas”.";
    case "order_not_claimable":
      return "Esta compra no se puede guardar por aquí.";
    case "order_not_found":
      return "No encontramos esta compra.";
    case "invalid_token":
      return "El enlace no es válido. Ábrelo completo desde donde te llegó.";
    default:
      return "Algo salió mal. Inténtalo de nuevo más tarde.";
  }
}

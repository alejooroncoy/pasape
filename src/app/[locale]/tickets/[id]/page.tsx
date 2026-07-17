"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Link2, Smartphone, Copy, Check, X, MessageCircle, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { QrSquare } from "@/components/design";
import { InstallNudge } from "@/components/pwa/InstallNudge";
import { HolderEditSheet } from "@/components/tickets/HolderEditSheet";
import { TransferTicketSheet } from "@/components/tickets/TransferTicketSheet";
import { RefundRequestSheet } from "@/components/tickets/RefundRequestSheet";
import { useTicket, useCancelTransfer, useMyTickets, useCarouselScope, ticketDetailKey } from "@/lib/tickets/hooks/useTickets";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useOnline } from "@/lib/_shared/useOnline";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import { useLocalRotatingQr, prewarmTicketCert } from "@/lib/tickets/hooks/useLocalRotatingQr";
import { clientEvents } from "@/lib/analytics/clientEvents";
import { useBoxForTicket, useRealtimeBox, useRemoveBoxMember, useAddBoxCompanion } from "@/lib/boxes/hooks/useBoxes";
import { formatDate } from "@/lib/_shared/format";
import { maskPhone } from "@/lib/tickets/phoneFormat";
import { CATEGORY_BY_ID } from "@/app/[locale]/_home/categories";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";
import type { Box } from "@/server/boxes/domain/Box";

type Props = { params: Promise<{ id: string }> };

// Key local (no sync entre dispositivos) para no repetir el nudge educativo del box.
const BOX_NUDGE_SEEN_KEY = "pasape:box_nudge_seen";

// Transición direccional del carrusel de entradas: la nueva entra desde el lado
// del gesto y la saliente sale hacia el opuesto. `dir` 1 = siguiente, -1 = anterior.
const cardVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : dir < 0 ? -300 : 0, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : dir < 0 ? 300 : 0, opacity: 0, scale: 0.96 }),
};

function TicketSkeleton() {
  return (
    <div className="min-h-dvh bg-cart-bg text-cart-ink">
      <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-5 py-3">
          <div className="h-5 w-16 animate-pulse rounded bg-cart-bg-elev-2" />
          <div className="h-5 w-24 animate-pulse rounded bg-cart-bg-elev-2" />
        </div>
      </header>
      <div className="mx-auto max-w-[640px] px-5 pt-6">
        <div className="aspect-square w-full animate-pulse rounded-3xl bg-cart-bg-elev" />
        <div className="mt-5 h-6 w-1/2 animate-pulse rounded bg-cart-bg-elev-2" />
        <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-cart-bg-elev-2" />
      </div>
    </div>
  );
}

// El detalle del ticket vive del cache cliente (React Query persistido) y genera
// el QR rotativo con WebCrypto en el device → renderizarlo en el server produce
// un árbol distinto al primer paint (hydration mismatch). Client-only con
// skeleton (ssr:false usa Suspense por debajo).
const TicketDetailClient = dynamic(() => Promise.resolve(TicketDetailInner), {
  ssr: false,
  loading: () => <TicketSkeleton />,
});

export default function TicketDetailPage({ params }: Props) {
  const { id } = use(params);
  return (
    <Suspense fallback={<TicketSkeleton />}>
      <TicketDetailClient id={id} />
    </Suspense>
  );
}

function TicketDetailInner({ id }: { id: string }) {
  const me = useCurrentUser();
  const qc = useQueryClient();
  // Entrada activa: la maneja un estado local (no la ruta) para poder cambiar de
  // tarjeta con un swipe SIN remontar la página → permite animar la transición
  // con motion. `direction` orienta la animación (1 = siguiente, -1 = anterior).
  const [activeId, setActiveId] = useState(id);
  const [direction, setDirection] = useState(0);
  const { data, isLoading, error } = useTicket(activeId);
  const cancelTransfer = useCancelTransfer();
  const online = useOnline();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const holderBtnRef = useRef<HTMLButtonElement>(null);
  const transferBtnRef = useRef<HTMLButtonElement>(null);
  const refundBtnRef = useRef<HTMLButtonElement>(null);
  // QR firmado (ECDSA): clave no-extraíble en el device + cert del evento.
  // Genera el QR rotativo 100% offline tras la primera carga. Si el ticket está
  // used/void, null evita carga.
  // Host del box actual (si aplica): el propio ticket si es el host, o el
  // referenciado si estás viendo un acompañante. listMine colapsa los
  // acompañantes que sostiene el host (no tienen fila propia en el wallet) —
  // así que al ver el QR de un acompañante, el host SÍ queda suelto en
  // myTickets y hay que excluirlo aparte para no contarlo dos veces junto al
  // carrusel del box (que ya lo muestra).
  const isBoxTicket = !!data?.boxLabel;
  const currentBoxHostId = isBoxTicket ? data?.boxHostTicketId ?? activeId : null;

  // Tickets hermanos: otras entradas activas del mismo evento, fuera del box
  // actual (sus QR ya se navegan por el carrusel de arriba). Es presentación
  // pura: alimenta el banner "Tienes X entradas más" (no el carrusel).
  const myTickets = useMyTickets();
  const siblingTickets = (myTickets.data ?? []).filter(
    (t) =>
      t.event.id === data?.event.id &&
      t.id !== activeId &&
      t.id !== currentBoxHostId &&
      t.status === "active",
  );
  // Scope del carrusel: calculado por el backend (lógica de negocio).
  // `eventTicketCount` es el conteo event-scoped (no del box) para el link "Ver todas".
  const scopeQuery = useCarouselScope(activeId);
  // Los IDs del carrusel y el índice actual vienen del backend (ver useCarouselScope).

  // Salta a otra entrada del evento sin navegar: actualiza la URL de forma
  // cosmética (history.replaceState) para que siga siendo compartible/recargable.
  const goToTicket = (targetId: string | null, dir: number) => {
    if (!targetId || targetId === activeId) return;
    setDirection(dir);
    setActiveId(targetId);
    if (typeof window !== "undefined") {
      const path = window.location.pathname.replace(/[^/]+$/, targetId);
      window.history.replaceState(window.history.state, "", path);
    }
  };

  // Deep-link de transferencia: si se llega con ?action=transfer (desde la lista
  // "Ver todas"), abre directo el modal de transferir una vez cargado el ticket.
  const searchParams = useSearchParams();
  const action = searchParams.get("action");
  const actionDone = useRef(false);
  useEffect(() => {
    if (actionDone.current) return;
    if (data?.status !== "active" || data.pendingTransferTo) return;
    if (action === "transfer") {
      actionDone.current = true;
      setOpen(true);
    } else if (action === "holder") {
      actionDone.current = true;
      setEditOpen(true);
    }
  }, [action, data?.status, data?.pendingTransferTo]);


  // No pedimos cert/QR si la orden aún está en revisión (in_process): el server
  // no lo emite hasta que esté pagada, así que evitamos el fetch fallido.
  const [qrRetryNonce, setQrRetryNonce] = useState(0);
  const activeTicketId =
    data && data.status === "active" && data.orderStatus !== "pending" ? activeId : null;
  const rotating = useLocalRotatingQr(activeTicketId, undefined, qrRetryNonce);

  // ticket_viewed / ticket_qr_result: un solo disparo por ticket por sesión —
  // el usuario puede ir y volver en el carrusel sin que se repita el evento.
  const viewedRef = useRef<Set<string>>(new Set());
  const qrResultRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!data || viewedRef.current.has(activeId)) return;
    viewedRef.current.add(activeId);
    clientEvents.ticketViewed({ ticket_id: activeId, event_id: data.event.id, status: data.status });
  }, [activeId, data]);
  useEffect(() => {
    if (!activeTicketId || rotating.loading) return;
    // Incluye qrRetryNonce en la key: un reintento (botón "Reintentar") sí debe
    // reportar su propio resultado, no quedar silenciado por el intento previo.
    const key = `${activeTicketId}:${qrRetryNonce}`;
    if (qrResultRef.current.has(key)) return;
    qrResultRef.current.add(key);
    clientEvents.ticketQrResult({
      ticket_id: activeTicketId,
      ok: !!rotating.payload,
      error: rotating.error,
    });
  }, [activeTicketId, qrRetryNonce, rotating.loading, rotating.payload, rotating.error]);

  const isHost = isBoxTicket && !data?.boxHostTicketId;
  // Id del ticket host del box, estés en el host o en un acompañante que llevas:
  // así el carrusel del box sigue disponible al saltar entre sus QR.
  const boxHostId = currentBoxHostId;
  // El box se crea en el backend al confirmarse el pago (un box es una compra), y
  // como red de seguridad la propia lectura lo crea si faltara. Aquí el wallet solo
  // LEE — sin POST ni reintentos desde el cliente (eso generaba boxes duplicados).
  const boxQuery = useBoxForTicket(boxHostId ?? "");
  const box = boxQuery.data ?? null;
  useRealtimeBox(box?.inviteToken);
  // El viewer controla el box (es su host) tanto viendo su propio QR como el de
  // cualquier acompañante que sostiene — el panel de gestión debe verse en ambos,
  // no solo en el QR del host, para poder navegar de QR en QR desde el roster.
  const controlsBox =
    isHost || (isBoxTicket && (box?.members.find((m) => m.ticketId === activeId)?.heldByHost ?? false));

  // El nudge flotante "comparte tu box" se oculta apenas el panel entra en
  // pantalla (ya bajaste, ya lo ves → sobra). IntersectionObserver sobre #box-panel.
  const [panelInView, setPanelInView] = useState(false);
  useEffect(() => {
    const el = document.getElementById("box-panel");
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPanelInView(entry.isIntersecting), {
      rootMargin: "0px 0px -25% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [box]);

  // El nudge es educativo: la primera vez le enseña al host que abajo está el panel
  // para invitar. Una vez que llegó al panel (lo vio), ya lo sabe — no se lo
  // repetimos en futuras compras de box. Lo recordamos local en el dispositivo.
  const [boxNudgeSeen, setBoxNudgeSeen] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(BOX_NUDGE_SEEN_KEY)) setBoxNudgeSeen(true);
    } catch {}
  }, []);
  useEffect(() => {
    if (!panelInView) return;
    try {
      localStorage.setItem(BOX_NUDGE_SEEN_KEY, "1");
    } catch {}
    setBoxNudgeSeen(true);
  }, [panelInView]);

  // Scope del carrusel (calculado en el backend): IDs ordenados y el índice actual.
  const carouselIds = scopeQuery.data?.ids ?? [];
  const currentIndex = scopeQuery.data?.currentIndex ?? -1;
  const prevTicketId = currentIndex > 0 ? carouselIds[currentIndex - 1] : null;
  const nextTicketId =
    currentIndex >= 0 && currentIndex < carouselIds.length - 1
      ? carouselIds[currentIndex + 1]
      : null;

  // Precarga offline-first de los vecinos: siembra el detalle desde la wallet si
  // existe y precalienta su cert para swipe instantáneo.
  useEffect(() => {
    for (const nid of [prevTicketId, nextTicketId]) {
      if (!nid) continue;
      const seed = (myTickets.data ?? []).find((t) => t.id === nid);
      if (seed) {
        qc.setQueryData(ticketDetailKey(nid), (prev: WalletTicket | undefined) => prev ?? seed);
      }
      void prewarmTicketCert(nid);
    }
  }, [activeId, prevTicketId, nextTicketId, myTickets.data, qc]);

  // Desktop: flechas ←/→ del teclado mueven el carrusel (no si el foco está en
  // un input). Reusa goToTicket para mantener la dirección de la animación.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowLeft" && prevTicketId) goToTicket(prevTicketId, -1);
      else if (e.key === "ArrowRight" && nextTicketId) goToTicket(nextTicketId, 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevTicketId, nextTicketId]);

  // Sin sesión, /tickets/[id] falla por RLS (current_holder = auth.uid()). En vez
  // de quedar en "No pudimos cargar tu entrada", mandamos a login con next para
  // volver acá tras entrar. Solo online y cuando `me` ya confirmó que no hay user
  // (offline-first: si no hay red, no rebotamos).
  const noSession = !isLoading && (error || !data) && online && !me.isLoading && !me.data?.user;
  useEffect(() => {
    if (!noSession) return;
    // Debounce: justo tras volver de Google OAuth, `useTicket` y `useCurrentUser`
    // pueden reportar "sin sesión" por una fracción de segundo mientras la
    // cookie termina de asentar — sin este margen redirigíamos a /login y de
    // inmediato de vuelta, tirando abajo el árbol de React (con cualquier hoja
    // de Radix abierta, ej. Cambiar datos/Enviar) a mitad de un commit y
    // disparando "React.Children.only" en Slot. 600ms alcanza para que ambas
    // queries asienten sin sentirse como demora para quien sí está deslogeado.
    const id = setTimeout(() => {
      const next = typeof window === "undefined" ? "" : window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}` as never);
    }, 600);
    return () => clearTimeout(id);
  }, [noSession, router]);

  if (isLoading || noSession) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cart-bg text-cart-ink-3">
        <span className="text-[13px]">Cargando…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cart-bg px-6 text-center text-cart-ink-2">
        <div>
          <p className="text-[15px]">No pudimos cargar tu entrada.</p>
          <button
            type="button"
            onClick={() => router.push("/tickets" as never)}
            className="mt-3 text-[13px] text-cart-accent underline"
          >
            Ver mis entradas
          </button>
        </div>
      </div>
    );
  }

  const holderName = data.holderName ?? me.data?.user?.fullName ?? "Tu pase";
  const eventDate = formatDate(data.event.startsAt, data.event.timezone);
  // Atrás vuelve a la lista del evento (con la actual resaltada) si tiene varias
  // entradas del evento; si es única, a "Mis entradas".
  // eventTicketCount viene del scope del backend (siempre event-scoped, nunca del carrusel del box).
  const backHref =
    (scopeQuery.data?.eventTicketCount ?? 0) > 1
      ? `/tickets?event=${data.event.id}&from=${activeId}`
      : "/tickets";

  return (
    <div className="min-h-dvh bg-cart-bg text-cart-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-5 py-3.5">
          <Link
            href={backHref}
            aria-label="Volver"
            className="grid size-9 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-cart-ink"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <span className="text-[12.5px] font-medium text-cart-ink-3">{isBoxTicket ? "Tu box" : "Tu entrada"}</span>
          <span className="size-9" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[640px] px-5 pb-16 pt-6 lg:max-w-[440px]">
        {/* Si esta página no quedó guardada como app, el QR no va a cargar sin
            señal en la puerta — ver AGENTS.md / memoria wallet-offline-asistente.
            Solo aplica a entradas activas: no tiene sentido pedir instalar la
            app para "entrar a la puerta" con una entrada ya usada/anulada. */}
        {data.status === "active" && <InstallNudge className="mb-4" />}

        {/* QR card — swipe horizontal para saltar a otra entrada del mismo evento.
            overflow-x-clip evita scroll lateral durante el slide. */}
        <div className="relative overflow-x-clip">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.div
          key={activeId}
          custom={direction}
          variants={cardVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 320, damping: 34 },
            opacity: { duration: 0.18 },
            scale: { duration: 0.22 },
          }}
          drag={carouselIds.length > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            const threshold = 60;
            // Considera velocidad: un flick corto pero rápido también pasa.
            const power = info.offset.x + info.velocity.x * 0.2;
            if (power < -threshold) goToTicket(nextTicketId, 1);
            else if (power > threshold) goToTicket(prevTicketId, -1);
          }}
          className="touch-pan-y overflow-hidden rounded-[28px] border border-cart-accent/40 bg-cart-bg-elev"
          style={{
            boxShadow: "0 24px 50px -22px rgba(40,20,90,0.35)",
          }}
        >
          {/* Héroe: portada del evento con estado, fecha y título */}
          <CoverHero
            event={data.event}
            eventDate={eventDate}
            status={data.status}
            boxLabel={isBoxTicket ? data.boxLabel : null}
          />

          {/* QR slot — white bg, padding tight, rotating ring overlay */}
          <div className="mx-6 mt-5 rounded-2xl bg-white p-5">
            {/* Box: dejar claro que ESTE QR es la entrada del titular (no algo
                aparte) y que además habilita invitar. Mata el "¿y mi entrada?". */}
            {isBoxTicket && (
              <div className="mb-3 text-center">
                <p className="flex items-center justify-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.04em] text-neutral-800">
                  <span className="size-[7px] rounded-full bg-emerald-600" />
                  Tu QR · Entrada al evento
                </p>
                {box && box.capacity > 1 && (
                  <p className="mt-0.5 text-[11.5px] font-semibold text-cart-accent-2">
                    + invita a {box.capacity - 1} personas a tu box
                  </p>
                )}
              </div>
            )}
            <div className="relative mx-auto grid size-[240px] place-items-center">
              {data.orderStatus === "pending" ? (
                // Pago en revisión (in_process): el banco aún no confirma. Sin QR
                // hasta que se apruebe (el cert se emite solo con la orden pagada).
                <div className="grid size-[240px] place-items-center gap-3 px-6 text-center">
                  <div className="grid size-[88px] place-items-center rounded-full bg-amber-400/15 ring-1 ring-amber-400/30">
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="#d97706" strokeWidth="2" />
                      <path d="M12 7.5v5l3 2" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold tracking-[-0.01em] text-neutral-900">Pago en revisión</div>
                    <div className="mt-1 text-[12.5px] leading-relaxed text-neutral-500">
                      Tu banco está confirmando el pago. Apenas lo apruebe, aquí aparece tu QR.
                    </div>
                  </div>
                </div>
              ) : data.status === "pending_approval" ? (
                // RSVP con aprobación: el organizador no decidió aún. Sin QR
                // hasta que apruebe — nunca "lista de espera", es revisión.
                <div className="grid size-[240px] place-items-center gap-3 px-6 text-center">
                  <div className="grid size-[88px] place-items-center rounded-full bg-amber-400/15 ring-1 ring-amber-400/30">
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="#d97706" strokeWidth="2" />
                      <path d="M12 7.5v5l3 2" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold tracking-[-0.01em] text-neutral-900">Tu inscripción está en revisión</div>
                    <div className="mt-1 text-[12.5px] leading-relaxed text-neutral-500">
                      El organizador la revisará pronto. Te avisamos por correo y en la app en cuanto la apruebe.
                    </div>
                  </div>
                </div>
              ) : data.status === "used" ? (
                // Ya ingresó: estampa clara y bonita en vez del QR (que ya no sirve).
                <div className="grid size-[240px] place-items-center gap-3 px-6 text-center">
                  <div className="grid size-[88px] place-items-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/25">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12.5l5 5 11-12" stroke="#059669" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[18px] font-bold tracking-[-0.01em] text-neutral-900">Ya ingresaste</div>
                    {data.usedAt && (
                      <div className="mt-0.5 text-[12.5px] text-neutral-500">{formatDate(data.usedAt, data.event.timezone)}</div>
                    )}
                  </div>
                </div>
              ) : data.status === "void" || data.status === "refunded" ? (
                <div className="grid size-[240px] place-items-center gap-3 px-6 text-center">
                  <div className="grid size-[88px] place-items-center rounded-full bg-neutral-100 ring-1 ring-neutral-200">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="#9ca3af" strokeWidth="2" />
                      <path d="M6 6l12 12" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="text-[18px] font-bold tracking-[-0.01em] text-neutral-900">
                    {data.status === "refunded" ? "Entrada reembolsada" : "Entrada anulada"}
                  </div>
                </div>
              ) : rotating.payload ? (
                <QrSquare code={rotating.payload} size={240} errorCorrectionLevel="L" />
              ) : (
                <div className="grid size-[240px] place-content-center gap-3 px-4 text-center text-[13px] text-cart-ink-3">
                  {rotating.error ? (
                    <>
                      <p>
                        {rotating.error === "offline_no_cert"
                          ? "Necesitas conexión la primera vez para activar tu QR."
                          : "No pudimos generar el QR."}
                      </p>
                      <button
                        type="button"
                        onClick={() => setQrRetryNonce((n) => n + 1)}
                        className="rounded-full bg-cart-accent px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-110"
                      >
                        {rotating.error === "offline_no_cert" ? "Reintentar con conexión" : "Reintentar"}
                      </button>
                    </>
                  ) : (
                    "Generando QR…"
                  )}
                </div>
              )}
              {rotating.payload && <CountdownRing seconds={rotating.secondsLeft} />}
            </div>
          </div>

          {/* Below QR: titular a todo el ancho + acciones en su propia fila */}
          <div className="px-6 pb-5 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cart-ink-3">
                Titular
              </div>
              <div className="mt-0.5 truncate text-[14px] font-semibold">
                {holderName}
              </div>
              {/* En un box, ticketType.name === boxLabel (ya está en el cover);
                  mostrarlo sería repetir "Box B". Solo tiene sentido en entradas
                  individuales, donde es el tipo real (General/VIP). */}
              {!isBoxTicket && (
                <div className="text-[11.5px] text-cart-ink-3">{data.ticketType.name}</div>
              )}
              </div>
              {/* A primera vista: que es un box y cómo va, sin bajar. Toca → al panel. */}
              {isBoxTicket && box && (
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById("box-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cart-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-cart-accent transition active:scale-[0.97]"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <circle cx="5.5" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                    <circle cx="11" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M2 13c0-2 1.6-3.2 3.5-3.2S9 11 9 13M9.5 12.6c0-1.6 1.2-2.6 2.6-2.6S14.5 11 14.5 12.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  {box.members.length}/{box.capacity} en el box
                  <span className="text-cart-accent/60">›</span>
                </button>
              )}
            </div>
            {data.status === "active" && !data.pendingTransferTo && (
              <div className="mt-3.5 flex gap-2">
                <button
                  ref={holderBtnRef}
                  type="button"
                  onClick={() => setEditOpen(true)}
                  disabled={!online}
                  title={online ? undefined : "Necesitas conexión para esto"}
                  className="flex-1 rounded-full bg-cart-bg-elev-2 px-3.5 py-2.5 text-[12.5px] font-semibold text-cart-ink-2 transition hover:bg-cart-accent-soft hover:text-cart-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cambiar datos
                </button>
                <button
                  ref={transferBtnRef}
                  type="button"
                  onClick={() => setOpen(true)}
                  disabled={!online}
                  title={online ? undefined : "Necesitas conexión para enviar"}
                  className="flex-1 rounded-full bg-cart-bg-elev-2 px-3.5 py-2.5 text-[12.5px] font-semibold text-cart-ink-2 transition hover:bg-cart-accent-soft hover:text-cart-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            )}
          </div>
        </motion.div>
        </AnimatePresence>
        </div>

        {/* Navegación entre entradas del evento: dots + flechas (swipe en celular) */}
        {carouselIds.length > 1 && currentIndex >= 0 && (
          <div className="mt-3.5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => goToTicket(prevTicketId, -1)}
              disabled={!prevTicketId}
              aria-label="Entrada anterior"
              className="grid size-8 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-cart-ink disabled:opacity-30"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {carouselIds.length <= 8 ? (
              // Pocas entradas: dots tappables.
              <div className="flex items-center gap-1.5">
                {carouselIds.map((id, i) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => goToTicket(id, i > currentIndex ? 1 : -1)}
                    aria-label={`Entrada ${i + 1}`}
                    aria-current={i === currentIndex}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentIndex ? "w-5 bg-cart-accent" : "w-1.5 bg-cart-ink-4/25 hover:bg-cart-ink-4/40"
                    }`}
                  />
                ))}
              </div>
            ) : (
              // Muchas entradas: contador compacto en vez de un montón de dots.
              <span className="min-w-[64px] text-center text-[12.5px] font-semibold tabular-nums text-cart-ink-2">
                {currentIndex + 1}{" "}
                <span className="text-cart-ink-3">/ {carouselIds.length}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => goToTicket(nextTicketId, 1)}
              disabled={!nextTicketId}
              aria-label="Entrada siguiente"
              className="grid size-8 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-cart-ink disabled:opacity-30"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Aviso: hay más entradas de este evento. No es navegación (de eso se
            encarga el carrusel de arriba) — solo informa y enseña el gesto. */}
        {siblingTickets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.22 }}
            className="mt-4 flex items-center gap-3 rounded-2xl border border-cart-accent/25 bg-cart-accent/[0.07] px-4 py-3.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 text-cart-accent">
              <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M14 7v10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
            </svg>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-cart-ink">
                {siblingTickets.length === 1 ? "Tienes 1 entrada más" : `Tienes ${siblingTickets.length} entradas más`}
              </p>
              <p className="text-[11.5px] text-cart-ink-3">
                Deslízalas o velas todas para repartirlas
              </p>
            </div>
            <Link
              href={`/tickets?event=${data.event.id}&from=${activeId}`}
              className="shrink-0 rounded-full border border-cart-accent/40 bg-transparent px-3.5 py-1.5 text-[12px] font-semibold text-cart-accent transition hover:bg-cart-accent/10 active:scale-95"
            >
              Ver todas
            </Link>
          </motion.div>
        )}

        {/* Envío pendiente: la entrada sigue siendo tuya hasta que la reclamen.
            El emisor ve a quién la mandó y puede recuperarla al instante. */}
        {data.status === "active" && data.pendingTransferTo && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-amber-500">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 5.5V9l2.3 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-cart-ink">
                  Enviada al {maskPhone(data.pendingTransferTo)}
                </div>
                <p className="mt-0.5 text-[11.5px] leading-[1.45] text-cart-ink-3">
                  Esperando que la reclame por WhatsApp. Sigue siendo tuya hasta
                  entonces — puedes recuperarla cuando quieras.
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => cancelTransfer.mutate({ ticketId: data.id })}
                    disabled={cancelTransfer.isPending || !online}
                    title={online ? undefined : "Necesitas conexión para cancelar"}
                    className="text-[12.5px] font-semibold text-amber-600 transition hover:text-amber-700 disabled:opacity-50"
                  >
                    {cancelTransfer.isPending ? "Recuperando…" : "Cancelar envío"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel del box (host) — invitar inline, debajo del QR (columna única
            centrada, igual en mobile y desktop). Si aún se crea, placeholder. */}
        {controlsBox && data.status === "active" && (
          box ? (
            <BoxPanel
              box={box}
              activeTicketId={activeId}
              onNavigate={(tid) => goToTicket(tid, tid === boxHostId ? -1 : 1)}
            />
          ) : (
            <div className="mt-4 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-4 text-[13px] text-cart-ink-3">
              Preparando tu box…
            </div>
          )
        )}

        {/* Security note */}
        {data.status === "active" && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-cart-accent/30 bg-cart-accent-soft px-4 py-3">
            <span className="mt-0.5 text-cart-accent">
              <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
                <path
                  d="M11 2L3 5v5c0 4.5 3.2 8.5 8 10 4.8-1.5 8-5.5 8-10V5l-8-3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M7.5 11l2.5 2.5L14.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="text-[13px] leading-[1.45]">
              <div className="font-semibold text-cart-ink">Tu QR cambia cada 10 segundos</div>
              <div className="mt-0.5 text-[11.5px] text-cart-ink-3">
                Las capturas no sirven. Mantén esta página abierta al entrar.
              </div>
            </div>
          </div>
        )}

        {/* Reembolso: acción discreta al pie — no compite con Enviar/Cambiar
            datos. Solo en entradas activas y ya pagadas (una orden en revisión
            aún no tiene pago que reembolsar). El backend igual valida dueño +
            pago; acá solo abrimos la solicitud (revisión manual del equipo). */}
        {data.status === "active" && !data.pendingTransferTo && data.orderStatus !== "pending" && (
          <div className="mt-6 text-center">
            <button
              ref={refundBtnRef}
              type="button"
              onClick={() => setRefundOpen(true)}
              disabled={!online}
              title={online ? undefined : "Necesitas conexión para esto"}
              className="text-[12.5px] font-medium text-cart-ink-3 underline decoration-cart-line-strong underline-offset-4 transition hover:text-cart-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ¿Un problema con esta entrada? Solicitar reembolso
            </button>
          </div>
        )}
      </main>

      {/* Nudge fijo del box (mobile y desktop): barrita atenuada/glassy que recuerda
          el siguiente paso — invitar al box — porque el panel está bajo el fold y
          sin esto no sabrías que existe. En mobile flota sobre el tabbar; en desktop
          (sin tabbar) más abajo. Se desvanece sola apenas el panel entra en pantalla
          (ya bajaste → sobra). Solo host, activo y con lugares libres. */}
      <AnimatePresence>
        {isHost && box && data.status === "active" && box.members.length < box.capacity && !panelInView && !boxNudgeSeen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4 bottom-[calc(env(safe-area-inset-bottom,0px)+66px)] lg:bottom-8"
          >
            <button
              type="button"
              onClick={() =>
                document.getElementById("box-panel")?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className="pointer-events-auto flex w-full max-w-[460px] items-center gap-2.5 rounded-full border border-emerald-500/25 bg-emerald-100/90 px-3.5 py-2.5 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl transition active:scale-[0.98]"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-600/15 text-emerald-700">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="5.5" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                  <circle cx="11" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M2 13c0-2 1.6-3.2 3.5-3.2S9 11 9 13M9.5 12.6c0-1.6 1.2-2.6 2.6-2.6S14.5 11 14.5 12.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-[12.5px] font-semibold text-emerald-950">
                Comparte tu box con tus compañeros
              </span>
              <span className="shrink-0 text-[12px] font-bold text-emerald-700">Invitar ›</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <TransferTicketSheet
        open={open}
        ticketId={data.id}
        online={online}
        anchorRef={transferBtnRef}
        onClose={() => setOpen(false)}
      />

      <HolderEditSheet
        open={editOpen}
        ticketId={data.id}
        currentName={data.holderName}
        currentDniLast2={data.holderDniLast2}
        ticketTypeName={data.ticketType.name}
        online={online}
        anchorRef={holderBtnRef}
        variant="yours"
        onClose={() => setEditOpen(false)}
      />

      <RefundRequestSheet
        open={refundOpen}
        ticketId={data.id}
        online={online}
        anchorRef={refundBtnRef}
        onClose={() => setRefundOpen(false)}
      />
    </div>
  );
}

// Héroe del activo: portada del evento con spotlight en hover (desktop),
// estado, fecha y título sobre la imagen. Identidad del ticket como activo.
function CoverHero({
  event,
  eventDate,
  status,
  boxLabel,
}: {
  event: WalletTicket["event"];
  eventDate: string;
  status: WalletTicket["status"];
  boxLabel: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ x: 50, y: 50, on: false });
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, on: true });
  };
  const cover = event.coverUrl;
  const gradient =
    event.category && CATEGORY_BY_ID[event.category]
      ? CATEGORY_BY_ID[event.category].gradient
      : "linear-gradient(150deg, rgba(124,58,237,0.6), rgba(124,58,237,0.15))";
  const dim = status !== "active";

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => setSpot((s) => ({ ...s, on: false }))}
      className="relative h-[180px] w-full"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={optimizeImageUrl(cover, "event-hero") ?? cover} alt="" className={"absolute inset-0 size-full object-cover " + (dim ? "grayscale" : "")} />
      ) : (
        <div className="absolute inset-0" style={{ background: gradient }} />
      )}
      {/* Scrim fuerte abajo para que fecha/título siempre se lean,
          aunque el flyer sea claro. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.78) 26%, rgba(0,0,0,0.32) 55%, transparent 82%)",
        }}
      />

      {/* Spotlight (solo desktop con hover) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: spot.on ? 1 : 0,
          background: `radial-gradient(200px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.16) 0%, transparent 24%, rgba(0,0,0,0.45) 72%)`,
          mixBlendMode: "soft-light",
        }}
      />

      {/* Top: estado */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <StatusBadge status={status} />
        {boxLabel && (
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-md">
            {/^box\b/i.test(boxLabel.trim()) ? boxLabel : `Box ${boxLabel}`}
          </span>
        )}
      </div>

      {/* Bottom: fecha + título — con sombra para legibilidad sobre cualquier flyer */}
      <div className="absolute inset-x-0 bottom-0 p-4 [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#e0d0ff] [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_2px_12px_rgba(0,0,0,0.85)]">{eventDate}</p>
        <h1 className="mt-0.5 text-[22px] font-bold leading-tight tracking-[-0.02em] text-white">
          {event.title}
        </h1>
        {event.venue && <p className="mt-0.5 text-[12px] text-white/85">{event.venue}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WalletTicket["status"] }) {
  if (status === "used") {
    return (
      <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70 backdrop-blur-md">
        Ya usada
      </span>
    );
  }
  if (status === "void" || status === "refunded") {
    return (
      <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 backdrop-blur-md">
        Anulada
      </span>
    );
  }
  if (status === "pending_approval") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300 backdrop-blur-md">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" />
          <path d="M12 7.5v5l3 2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        En revisión
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300 backdrop-blur-md">
      <span className="size-1.5 rounded-full bg-emerald-400" /> Válida · firmada
    </span>
  );
}

function CountdownRing({ seconds }: { seconds: number }) {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, (10 - seconds) / 10));
  const offset = circumference * progress;
  return (
    <div className="absolute -right-[12px] -top-[12px] grid size-12 place-items-center rounded-full bg-cart-bg shadow-[0_0_0_2px_var(--color-cart-bg-elev),0_8px_20px_rgba(0,0,0,0.4)]">
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        className="absolute inset-0 -rotate-90"
      >
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--color-cart-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: "drop-shadow(0 0 6px var(--color-cart-accent-glow))",
            transition: "stroke-dashoffset 1s linear",
          }}
        />
      </svg>
      <span className="text-[13px] font-bold tracking-[-0.02em] text-cart-accent">
        {seconds}s
      </span>
    </div>
  );
}

/* ============================== Box panel (host) ============================== */
// Gestión inline del box para el host: invitar (link + WhatsApp), ver quién
// entró y quitar a alguien. Resuelve las dudas del usuario con copy claro:
// el QR ya sirve, cada uno recibe el suyo, y los asientos vacíos dicen "Libre".
function BoxPanel({
  box,
  activeTicketId,
  onNavigate,
}: {
  box: Box;
  activeTicketId: string;
  onNavigate: (ticketId: string) => void;
}) {
  const removeMember = useRemoveBoxMember();
  const addCompanion = useAddBoxCompanion();
  const [copied, setCopied] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Flujo único de "Agregar a alguien": cerrado → elegir cómo → formulario sin cel.
  const [addMode, setAddMode] = useState<"closed" | "choose" | "companion">("closed");
  const [cName, setCName] = useState("");
  const [cDni, setCDni] = useState("");
  const addInFlightRef = useRef(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = `${origin}/box/${box.inviteToken}`;
  const filled = box.members.length;
  const remaining = Math.max(0, box.capacity - filled);
  // Nombre del box sin duplicar "Box" (box_label suele venir ya como "Box B").
  const rawLabel = box.boxNumber?.trim();
  const boxName = rawLabel
    ? /^box\b/i.test(rawLabel)
      ? rawLabel
      : `Box ${rawLabel}`
    : box.ticketTypeName;
  const host = box.members.find((m) => m.ticketId) ?? box.members[0];

  const cDniValid = cDni === "" || /^\d{8}$/.test(cDni);
  const canAdd = cName.trim().length >= 2 && cDniValid && !addCompanion.isPending;
  const submitCompanion = () => {
    if (addInFlightRef.current || !canAdd) return;
    addInFlightRef.current = true;
    addCompanion.mutate(
      { token: box.inviteToken, holderName: cName.trim(), holderDni: cDni || undefined },
      {
        onSuccess: () => {
          setCName("");
          setCDni("");
          setAddMode("closed");
        },
        onSettled: () => {
          addInFlightRef.current = false;
        },
      },
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const share = () => {
    const msg = encodeURIComponent(`Sumate a mi box en ${box.event.title}: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div id="box-panel" className="mt-4 scroll-mt-4 rounded-2xl border border-cart-accent/25 bg-cart-accent/[0.06] p-4">
      {/* Header claro del box: identidad + para cuántos (nada de bloque morado) */}
      <div className="flex items-center gap-3">
        <span className="inline-flex shrink-0 items-baseline gap-1.5 rounded-[12px] bg-cart-accent px-2.5 py-1.5 text-white">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] opacity-85">Box</span>
          <span className="text-[18px] font-black leading-none tracking-[-0.02em]">
            {(box.boxNumber ?? "").replace(/^box\s*/i, "").trim() || boxName}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-cart-ink">Para {box.capacity} personas</h2>
          <p className="truncate text-[11.5px] font-semibold text-cart-ink-3">Reservado a tu nombre · invítalos a llenar tu box</p>
        </div>
      </div>

      {/* Barra de progreso con acento */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-cart-bg-elev-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cart-accent to-cart-accent-2"
            style={{ width: `${Math.round((filled / Math.max(1, box.capacity)) * 100)}%` }}
          />
        </div>
        <span className="shrink-0 text-[12px] font-bold text-cart-ink-2">
          <b className="text-cart-accent">{filled}</b> con lugar
          {remaining > 0 && (
            <>
              {" "}· faltan <b className="text-cart-accent">{remaining}</b>
            </>
          )}
        </span>
      </div>

      {/* Invitar: un CTA protagonista (WhatsApp) + copiar link como ícono */}
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={share}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-[14px] font-bold text-[#062315] transition active:scale-[0.98]"
        >
          <MessageCircle size={17} strokeWidth={2.2} className="fill-[#062315]" />
          Invitar ↗
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label="Copiar link de invitación"
          className="grid w-[52px] place-items-center rounded-xl bg-cart-bg-elev-2 text-cart-accent shadow-[0_0_0_1px_var(--color-cart-line)_inset] transition active:scale-[0.96]"
        >
          {copied ? (
            <Check size={18} strokeWidth={2.4} />
          ) : (
            <Copy size={18} strokeWidth={1.8} />
          )}
        </button>
      </div>
      {/* Tranquilidad como hint, no banner */}
      <p className="mt-2 text-center text-[11.5px] text-cart-ink-3">
        Tu QR ya sirve aunque el box no se complete.
      </p>

      {/* Roster: una línea por persona, el chip dice el estado */}
      <div className="mt-5 flex items-baseline justify-between px-0.5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-cart-ink-4">
          Quiénes van<span className="text-cart-accent">.</span>
        </p>
        <p className="text-[13px] font-bold text-cart-ink">
          {filled} <span className="font-semibold text-cart-ink-4">/ {box.capacity}</span>
        </p>
      </div>
      <div className="mt-2">
        <div className="divide-y divide-cart-line">
          {box.members.map((m) => {
            const isHostMember = m.profileId === host?.profileId;
            // Lo "llevas tú" si su QR lo sostiene el host (acompañante sin cel):
            // el backend lo marca comparando current_holder con el dueño del box.
            const heldByYou = !isHostMember && m.heldByHost;
            // Navegable = es un QR que el viewer controla (el suyo propio como
            // host, o el de un acompañante que sostiene) — nunca el de alguien
            // que se unió por su cuenta (ese QR no es tuyo para mostrar).
            const navigable = !!m.ticketId && (isHostMember || heldByYou);
            const isActive = navigable && m.ticketId === activeTicketId;
            const confirming = confirmId === m.profileId;
            const initial = (m.name?.[0] ?? "?").toUpperCase();
            return (
              <div
                key={m.profileId}
                className={
                  "flex w-full items-center gap-3 rounded-xl py-2.5 text-left transition " +
                  (isActive ? "-mx-2 bg-cart-accent/[0.08] px-2" : "")
                }
              >
                {confirming ? (
                  <button
                    type="button"
                    aria-label="Cancelar"
                    onClick={() => setConfirmId(null)}
                    className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-cart-bg-elev-2 text-cart-ink-3 transition hover:bg-cart-accent-soft active:scale-95"
                  >
                    <X size={16} strokeWidth={2.2} />
                  </button>
                ) : (
                  <span
                    className={
                      "grid size-9 shrink-0 place-items-center rounded-[10px] text-[14px] font-bold transition " +
                      (isHostMember
                        ? "bg-cart-accent text-white"
                        : heldByYou
                          ? "bg-gradient-to-br from-cart-accent to-cart-accent-2 text-white"
                          : "bg-cart-bg-elev-2 text-cart-ink")
                    }
                  >
                    {initial}
                  </span>
                )}
                {/* Nombre: navega directo a ese QR si es un QR que controlas
                    (el tuyo o el de un acompañante que llevas) y no es el que
                    ya estás viendo. Chevron marca que se puede tocar. */}
                {navigable && !isActive ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(m.ticketId as string)}
                    className="flex flex-1 items-center gap-1 truncate text-left text-[14px] font-semibold text-cart-ink transition active:scale-[0.99]"
                  >
                    <span className="truncate">{confirming ? `¿Quitar a ${m.name}?` : isHostMember ? "Tú" : m.name}</span>
                    <ChevronRight size={14} strokeWidth={2.4} className="shrink-0 text-cart-ink-4" />
                  </button>
                ) : (
                  <span className="flex-1 truncate text-[14px] font-semibold">
                    {confirming ? `¿Quitar a ${m.name}?` : isHostMember ? "Tú" : m.name}
                  </span>
                )}
                {/* Acción a la derecha: estado + X explícita para quitar. */}
                {isActive ? (
                  <span className="shrink-0 text-[11px] font-medium text-cart-accent">Viendo ahora</span>
                ) : confirming ? (
                  <button
                    type="button"
                    disabled={removeMember.isPending}
                    onClick={() =>
                      removeMember.mutate(
                        { token: box.inviteToken, memberProfileId: m.profileId },
                        { onSettled: () => setConfirmId(null) },
                      )
                    }
                    className="shrink-0 rounded-full bg-red-500 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-60"
                  >
                    Quitar
                  </button>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    {m.used ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                        <span className="size-1.5 rounded-full bg-emerald-500" /> entró
                      </span>
                    ) : heldByYou ? (
                      <span className="rounded-full bg-cart-accent-soft px-2 py-0.5 text-[11px] font-semibold text-cart-accent">
                        📱 lo llevas tú
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-cart-ink-4">en el box</span>
                    )}
                    {/* Solo se puede quitar mientras no haya entrado (status "used"). */}
                    {!m.used && (
                      <button
                        type="button"
                        aria-label={`Quitar a ${m.name ?? "este invitado"}`}
                        onClick={() => {
                          setConfirmId(m.profileId);
                          setTimeout(
                            () => setConfirmId((c) => (c === m.profileId ? null : c)),
                            3000,
                          );
                        }}
                        className="-mr-1.5 grid size-9 place-items-center rounded-full text-red-500 transition hover:bg-red-500/10 hover:text-red-600 active:scale-95"
                      >
                        <X size={15} strokeWidth={2.4} aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sumar a alguien: un solo punto de entrada → elegir cómo. */}
      {remaining > 0 && (
        addMode === "companion" ? (
          <div className="mt-3 space-y-2 rounded-2xl border border-cart-line bg-cart-bg-elev p-3">
            <p className="text-[12.5px] font-semibold">Agregar a alguien sin celular</p>
            <input
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="Nombre y apellido"
              className="w-full rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5 text-[14px] outline-none focus:border-cart-accent/60"
            />
            <input
              value={cDni}
              onChange={(e) => setCDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              placeholder="DNI (8 dígitos)"
              className="w-full rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5 text-[14px] outline-none focus:border-cart-accent/60"
            />
            {addCompanion.isError && (
              <p className="text-[11.5px] text-red-500">No se pudo agregar. Reintenta.</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitCompanion}
                disabled={!canAdd}
                className="flex-1 rounded-full bg-cart-accent py-2.5 text-[13px] font-semibold text-cart-bg disabled:opacity-40"
              >
                {addCompanion.isPending ? "Agregando…" : "Agregar"}
              </button>
              <button
                type="button"
                onClick={() => setAddMode("choose")}
                className="rounded-full border border-cart-line px-4 py-2.5 text-[13px] font-semibold text-cart-ink-3"
              >
                Volver
              </button>
            </div>
            <p className="text-[11px] leading-snug text-cart-ink-3">
              Su QR queda en tu celular — lo muestras tú en la puerta.
            </p>
          </div>
        ) : addMode === "choose" ? (
          <div className="mt-3 space-y-2 rounded-2xl border border-cart-line bg-cart-bg-elev p-3">
            <p className="text-[12.5px] font-semibold">¿Cómo lo agregas?</p>
            <button
              type="button"
              onClick={() => { share(); setAddMode("closed"); }}
              className="flex w-full items-center gap-3 rounded-xl border border-cart-line bg-cart-bg p-3 text-left transition active:scale-[0.99]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-cart-accent-soft text-cart-accent">
                <Link2 size={17} strokeWidth={2} />
              </span>
              <span className="text-[13px] font-semibold">Mandarle el link
                <span className="block text-[11px] font-normal text-cart-ink-3">Llega solo y recibe su QR</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode("companion")}
              className="flex w-full items-center gap-3 rounded-xl border border-cart-line bg-cart-bg p-3 text-left transition active:scale-[0.99]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-cart-accent-soft text-cart-accent">
                <Smartphone size={17} strokeWidth={2} />
              </span>
              <span className="text-[13px] font-semibold">No tiene celular
                <span className="block text-[11px] font-normal text-cart-ink-3">Su QR lo llevas tú</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode("closed")}
              className="w-full pt-1 text-center text-[12px] font-semibold text-cart-ink-3"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddMode("choose")}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-cart-line-strong p-3 text-left transition hover:border-cart-accent/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-cart-accent-soft text-cart-accent">
              <Plus size={20} strokeWidth={2.4} />
            </span>
            <span className="text-[13.5px] font-semibold text-cart-ink">Agregar a alguien
              <span className="block text-[11px] font-normal text-cart-ink-3">
                {remaining === 1 ? "Queda 1 lugar" : `Quedan ${remaining} lugares`}
              </span>
            </span>
          </button>
        )
      )}
    </div>
  );
}

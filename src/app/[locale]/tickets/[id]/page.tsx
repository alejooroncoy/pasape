"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Plus, Link2, Smartphone, Copy, Check, X, MessageCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { QrSquare } from "@/components/design";
import { useTicket, useTransferTicket, useCancelTransfer, useMyTickets, useSetHolder, useCarouselScope } from "@/lib/tickets/hooks/useTickets";
import { useProfileLookup } from "@/lib/identity/hooks/useProfileLookup";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useOnline } from "@/lib/_shared/useOnline";
import { useLocalRotatingQr, prewarmTicketCert } from "@/lib/tickets/hooks/useLocalRotatingQr";
import { useBoxForTicket, useRealtimeBox, useCreateBox, useRemoveBoxMember, useAddBoxCompanion } from "@/lib/boxes/hooks/useBoxes";
import { formatDate } from "@/lib/_shared/format";
import { CATEGORY_BY_ID } from "@/app/[locale]/_home/categories";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";
import type { Box } from "@/server/boxes/domain/Box";

type Props = { params: Promise<{ id: string }> };

// Transición direccional del carrusel de entradas: la nueva entra desde el lado
// del gesto y la saliente sale hacia el opuesto. `dir` 1 = siguiente, -1 = anterior.
const cardVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : dir < 0 ? -300 : 0, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : dir < 0 ? 300 : 0, opacity: 0, scale: 0.96 }),
};

export default function TicketDetailPage({ params }: Props) {
  const { id } = use(params);
  const me = useCurrentUser();
  const qc = useQueryClient();
  // Entrada activa: la maneja un estado local (no la ruta) para poder cambiar de
  // tarjeta con un swipe SIN remontar la página → permite animar la transición
  // con motion. `direction` orienta la animación (1 = siguiente, -1 = anterior).
  const [activeId, setActiveId] = useState(id);
  const [direction, setDirection] = useState(0);
  const { data, isLoading, error } = useTicket(activeId);
  const transfer = useTransferTicket();
  const cancelTransfer = useCancelTransfer();
  const online = useOnline();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  // QR firmado (ECDSA): clave no-extraíble en el device + cert del evento.
  // Genera el QR rotativo 100% offline tras la primera carga. Si el ticket está
  // used/void, null evita carga.
  // Tickets hermanos: otras entradas activas del mismo evento (excluye la actual).
  // Es presentación pura: alimenta el banner "Tienes X entradas más" (no el carrusel).
  const myTickets = useMyTickets();
  const siblingTickets = (myTickets.data ?? []).filter(
    (t) => t.event.id === data?.event.id && t.id !== activeId && t.status === "active",
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


  const activeTicketId = data && data.status === "active" ? activeId : null;
  const rotating = useLocalRotatingQr(activeTicketId);
  const isBoxTicket = !!data?.boxLabel;
  const isHost = isBoxTicket && !data?.boxHostTicketId;
  // Id del ticket host del box, estés en el host o en un acompañante que llevas:
  // así el carrusel del box sigue disponible al saltar entre sus QR.
  const boxHostId = isHost ? activeId : isBoxTicket ? data?.boxHostTicketId ?? null : null;
  const boxQuery = useBoxForTicket(boxHostId ?? "");
  const createBox = useCreateBox();
  // Auto-crear el box la primera vez que el host abre su entrada (antes vivía en
  // la subpágina). La capacidad real la define el server desde el ticket_type.
  useEffect(() => {
    if (
      isHost &&
      data?.status === "active" &&
      boxQuery.data === null &&
      !createBox.isPending &&
      !createBox.data
    ) {
      createBox.mutate({ ticketId: activeId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, data?.status, boxQuery.data, activeId]);
  const box = boxQuery.data ?? createBox.data ?? null;
  useRealtimeBox(box?.inviteToken);

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
        qc.setQueryData(
          ["tickets", "detail", nid, ""],
          (prev: WalletTicket | undefined) => prev ?? seed,
        );
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
  // Eco de confirmación: al escribir el número, buscamos a quién pertenece para
  // mostrarlo antes de soltar la entrada (capa anti-typo).
  const recipientDigits = recipient.replace(/\D/g, "");
  const recipientLookup = useProfileLookup(recipient);

  // Sin sesión, /tickets/[id] falla por RLS (current_holder = auth.uid()). En vez
  // de quedar en "No pudimos cargar tu entrada", mandamos a login con next para
  // volver acá tras entrar. Solo online y cuando `me` ya confirmó que no hay user
  // (offline-first: si no hay red, no rebotamos).
  const noSession = !isLoading && (error || !data) && online && !me.isLoading && !me.data?.user;
  useEffect(() => {
    if (!noSession) return;
    const next = typeof window === "undefined" ? "" : window.location.pathname + window.location.search;
    router.replace(`/login?next=${encodeURIComponent(next)}` as never);
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
    <div className="min-h-dvh bg-cart-bg text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-5 py-3.5">
          <Link
            href={backHref}
            aria-label="Volver"
            className="grid size-9 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white"
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
          className="touch-pan-y overflow-hidden rounded-[28px] border border-cart-accent/40"
          style={{
            background:
              "linear-gradient(180deg, rgba(124,58,237,0.28), rgba(20,12,40,0.6))",
            boxShadow:
              "0 30px 60px -20px rgba(124,58,237,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
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
              {rotating.payload ? (
                <QrSquare code={rotating.payload} size={240} />
              ) : (
                <div className="grid size-[240px] place-items-center px-4 text-center text-[13px] text-cart-ink-3">
                  {rotating.error
                    ? rotating.error === "offline_no_cert"
                      ? "Necesitas conexión la primera vez para activar tu QR. Conéctate y recarga."
                      : "No pudimos generar el QR. Recarga la página."
                    : "Generando QR…"}
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
                  type="button"
                  onClick={() => setEditOpen(true)}
                  disabled={!online}
                  title={online ? undefined : "Necesitas conexión para esto"}
                  className="flex-1 rounded-full bg-white/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cambiar datos
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  disabled={!online}
                  title={online ? undefined : "Necesitas conexión para enviar"}
                  className="flex-1 rounded-full bg-white/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
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
              className="grid size-8 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white disabled:opacity-30"
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
                      i === currentIndex ? "w-5 bg-cart-accent" : "w-1.5 bg-white/20 hover:bg-white/35"
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
              className="grid size-8 place-items-center rounded-full bg-cart-bg-elev text-cart-ink-2 transition hover:bg-cart-bg-elev-2 hover:text-white disabled:opacity-30"
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
              <p className="text-[13.5px] font-semibold text-white">
                {siblingTickets.length === 1 ? "Tienes 1 entrada más" : `Tienes ${siblingTickets.length} entradas más`}
              </p>
              <p className="text-[11.5px] text-white/45">
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
              <span className="mt-0.5 text-amber-300">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M9 5.5V9l2.3 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-white">
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
                    className="text-[12.5px] font-semibold text-amber-300 transition hover:text-amber-200 disabled:opacity-50"
                  >
                    {cancelTransfer.isPending ? "Recuperando…" : "Cancelar envío"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel del box (host) — invitar inline. Si aún se crea, placeholder. */}
        {isHost && data.status === "active" && (
          box ? (
            <BoxPanel box={box} />
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
              <div className="font-semibold text-white">Tu QR cambia cada 10 segundos</div>
              <div className="mt-0.5 text-[11.5px] text-cart-ink-3">
                Las capturas no sirven. Mantén esta página abierta al entrar.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Transfer sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[460px] rounded-t-[24px] border-t border-cart-line-strong bg-cart-bg-elev p-6 lg:rounded-3xl lg:border"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}
              initial={{ y: 60, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
            >
              <div className="mb-4 flex justify-center lg:hidden">
                <span className="h-1 w-9 rounded-full bg-white/15" />
              </div>
              <h2 className="text-[22px] font-bold tracking-[-0.02em]">
                Enviar entrada
              </h2>
              <p className="mt-2 text-[13px] leading-[1.5] text-cart-ink-3">
                Le llega por WhatsApp. La entrada <span className="font-semibold text-white">sigue siendo tuya</span> hasta
                que la abra y la reclame.
              </p>

              <label className="mt-5 block">
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-3">
                  WhatsApp del receptor
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.replace(/[^\d\s]/g, "").slice(0, 11))}
                  placeholder="987 654 321"
                  autoFocus
                  className="mt-1.5 block w-full rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 py-3.5 font-mono text-[15px] tracking-[0.04em] text-white outline-none transition focus:border-cart-accent focus:shadow-[0_0_0_3px_var(--color-cart-accent-soft)]"
                />
              </label>

              {/* Eco de confirmación: a quién le estás mandando, antes de soltar */}
              <div className="mt-2 min-h-[20px] text-[12.5px]">
                {recipientDigits.length > 0 && recipientDigits.length < 9 ? (
                  <span className="text-cart-ink-4">Faltan {9 - recipientDigits.length} dígitos</span>
                ) : recipientDigits.length === 9 && recipientLookup.loading ? (
                  <span className="text-cart-ink-3">Buscando…</span>
                ) : recipientDigits.length === 9 && recipientLookup.result?.found ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-300">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Le envías a <strong className="text-white">{recipientLookup.result.displayName}</strong>
                  </span>
                ) : recipientDigits.length === 9 ? (
                  <span className="text-cart-ink-3">Le llegará al <strong className="text-white">{formatPhone(recipientDigits)}</strong> por WhatsApp.</span>
                ) : null}
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={async () => {
                  try {
                    await transfer.mutateAsync({ ticketId: data.id, toPhone: recipientDigits });
                    setOpen(false);
                    setRecipient("");
                  } catch {
                    /* el error se muestra abajo */
                  }
                }}
                disabled={transfer.isPending || recipientDigits.length !== 9}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-cart-accent py-3.5 text-[14.5px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
              >
                {transfer.isPending && (
                  <motion.span
                    aria-hidden
                    className="size-4 rounded-full border-2 border-cart-bg/40 border-t-cart-bg"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, ease: "linear", duration: 0.7 }}
                  />
                )}
                {transfer.isPending
                  ? "Enviando…"
                  : recipientDigits.length === 9
                    ? `Enviar al ${formatPhone(recipientDigits)}`
                    : "Enviar entrada"}
              </motion.button>
              <AnimatePresence>
                {transfer.error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 text-center text-[12px] text-rose-300"
                  >
                    {transferErrorCopy((transfer.error as Error).message)}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sheet: cambiar datos del titular (nombre + DNI) */}
      <HolderEditSheet
        open={editOpen}
        ticketId={data.id}
        currentName={data.holderName}
        currentDniLast2={data.holderDniLast2}
        ticketTypeName={data.ticketType.name}
        online={online}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

// Sheet para asignar/editar el titular de la entrada (reparto post-compra).
function HolderEditSheet({
  open,
  ticketId,
  currentName,
  currentDniLast2,
  ticketTypeName,
  online,
  onClose,
}: {
  open: boolean;
  ticketId: string;
  currentName: string | null;
  currentDniLast2: string | null;
  ticketTypeName: string;
  online: boolean;
  onClose: () => void;
}) {
  const setHolder = useSetHolder();
  const [name, setName] = useState(currentName ?? "");
  const [dni, setDni] = useState("");

  // Resetea los campos al abrir (o si cambia la entrada activa por swipe).
  useEffect(() => {
    if (open) {
      setName(currentName ?? "");
      setDni("");
      setHolder.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticketId]);

  const dniValid = dni === "" || /^\d{8}$/.test(dni);
  const canSave =
    online && !setHolder.isPending && dniValid && (name.trim() !== (currentName ?? "") || dni !== "");

  const save = () => {
    if (!canSave) return;
    setHolder.mutate(
      { ticketId, holderName: name.trim() || null, dni: dni || undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] rounded-t-3xl border border-cart-line bg-cart-bg-elev px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 lg:rounded-3xl"
          >
            <div className="flex justify-center lg:hidden">
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <p className="mt-3 text-[15px] font-bold text-white">¿Quién usa esta entrada?</p>
            <p className="text-[12px] text-cart-ink-3">{ticketTypeName} · su nombre aparece en la puerta.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cart-ink-3">
                  Nombre
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. María García"
                  className="mt-1 w-full rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5 text-[14px] text-white outline-none focus:border-cart-accent/60"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cart-ink-3">
                  DNI <span className="text-white/25">(opcional)</span>
                </label>
                <input
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  inputMode="numeric"
                  placeholder={currentDniLast2 ? `•••••• ${currentDniLast2}` : "8 dígitos"}
                  className="mt-1 w-full rounded-xl border border-cart-line bg-cart-bg px-3 py-2.5 text-[14px] text-white outline-none focus:border-cart-accent/60"
                />
                {!dniValid && <p className="mt-1 text-[11px] text-red-400">El DNI debe tener 8 dígitos.</p>}
              </div>
            </div>

            {setHolder.isError && (
              <p className="mt-3 text-[12px] text-red-400">No se pudo guardar. Reintenta.</p>
            )}

            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="mt-4 w-full rounded-full bg-cart-accent px-4 py-3 text-[14px] font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {setHolder.isPending ? "Guardando…" : "Guardar"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
        <img src={cover} alt="" className={"absolute inset-0 size-full object-cover " + (dim ? "grayscale" : "")} />
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

// 987654321 → "987 654 321"
function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 9) return d;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

// 987654321 → "987•••321" (oculta el medio en el estado pendiente)
function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 6) return d;
  return `${d.slice(0, 3)}•••${d.slice(-3)}`;
}

function transferErrorCopy(raw: string): string {
  switch (raw) {
    case "transfer_window_closed":
      return "Ya no se puede enviar — la ventana cerró cerca del evento.";
    case "transfers_disabled":
      return "Este evento no permite transferencias.";
    case "transfer_limit_reached":
      return "Esta entrada alcanzó el máximo de transferencias.";
    case "not_owner":
      return "No eres el dueño actual de esta entrada.";
    case "ticket_not_active":
      return "Esta entrada ya no está activa (usada o anulada).";
    case "invalid_phone":
      return "Revisa el número — deben ser 9 dígitos.";
    case "recipient_required":
      return "Necesitamos a quién enviarla.";
    default:
      return raw;
  }
}

/* ============================== Box panel (host) ============================== */
// Gestión inline del box para el host: invitar (link + WhatsApp), ver quién
// entró y quitar a alguien. Resuelve las dudas del usuario con copy claro:
// el QR ya sirve, cada uno recibe el suyo, y los asientos vacíos dicen "Libre".
function BoxPanel({ box }: { box: Box }) {
  const router = useRouter();
  const removeMember = useRemoveBoxMember();
  const addCompanion = useAddBoxCompanion();
  const [copied, setCopied] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Flujo único de "Agregar a alguien": cerrado → elegir cómo → formulario sin cel.
  const [addMode, setAddMode] = useState<"closed" | "choose" | "companion">("closed");
  const [cName, setCName] = useState("");
  const [cDni, setCDni] = useState("");

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
    if (!canAdd) return;
    addCompanion.mutate(
      { token: box.inviteToken, holderName: cName.trim(), holderDni: cDni || undefined },
      {
        onSuccess: () => {
          setCName("");
          setCDni("");
          setAddMode("closed");
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
      {/* Ancla: nombre del box + capacidad (conecta con el modelo de ViaPase) */}
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-white">
          {boxName} <span className="font-semibold text-white/45">· {box.capacity} personas</span>
        </h2>
      </div>

      {/* Invitar: un CTA protagonista (WhatsApp) + copiar link como ícono */}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={share}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-[14px] font-bold text-[#062315] transition active:scale-[0.98]"
        >
          <MessageCircle size={17} strokeWidth={2.2} className="fill-[#062315]" />
          Invitar al box
        </button>
        <button
          type="button"
          onClick={copy}
          aria-label="Copiar link de invitación"
          className="grid w-[52px] place-items-center rounded-xl bg-black/35 text-cart-accent shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] transition active:scale-[0.96]"
        >
          {copied ? (
            <Check size={18} strokeWidth={2.4} />
          ) : (
            <Copy size={18} strokeWidth={1.8} />
          )}
        </button>
      </div>
      {/* Tranquilidad como hint, no banner */}
      <p className="mt-2 text-center text-[11.5px] text-white/45">
        Tu QR ya sirve aunque el box no se complete.
      </p>

      {/* Roster: una línea por persona, el chip dice el estado */}
      <div className="mt-4 flex items-baseline justify-between px-0.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/40">En el box</p>
        <p className="text-[13px] font-bold">
          {filled} <span className="font-semibold text-white/40">/ {box.capacity}</span>
        </p>
      </div>
      <div className="mt-2">
        <div className="divide-y divide-cart-line">
          {box.members.map((m) => {
            const you = m.profileId === host?.profileId;
            // Lo "llevas tú" si su QR lo sostiene el host (acompañante sin cel):
            // el backend lo marca comparando current_holder con el dueño del box.
            const heldByYou = !you && m.heldByHost;
            const confirming = confirmId === m.profileId;
            const initial = (m.name?.[0] ?? "?").toUpperCase();
            return (
              <div
                key={m.profileId}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                {confirming ? (
                  <button
                    type="button"
                    aria-label="Cancelar"
                    onClick={() => setConfirmId(null)}
                    className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.08] text-white/70 transition hover:bg-white/[0.14] active:scale-95"
                  >
                    <X size={16} strokeWidth={2.2} />
                  </button>
                ) : (
                  <span
                    className={
                      "grid size-9 shrink-0 place-items-center rounded-[10px] text-[14px] font-bold transition " +
                      (you
                        ? "bg-cart-accent text-cart-bg"
                        : heldByYou
                          ? "bg-gradient-to-br from-cart-accent to-cart-accent-2 text-white"
                          : "bg-white/[0.08] text-white")
                    }
                  >
                    {initial}
                  </span>
                )}
                {/* Nombre: solo navega si su QR lo llevas tú (acompañante). */}
                {heldByYou ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/tickets/${m.ticketId}` as never)}
                    className="flex-1 truncate text-left text-[14px] font-semibold"
                  >
                    {m.name}
                  </button>
                ) : (
                  <span className="flex-1 truncate text-[14px] font-semibold">
                    {confirming ? `¿Quitar a ${m.name}?` : you ? "Tú" : m.name}
                  </span>
                )}
                {/* Acción a la derecha: estado + X explícita para quitar. */}
                {you ? (
                  <span className="shrink-0 text-[11px] font-medium text-white/40">tu QR ↑</span>
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
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                        <span className="size-1.5 rounded-full bg-emerald-400" /> entró
                      </span>
                    ) : heldByYou ? (
                      <span className="rounded-full bg-cart-accent-soft px-2 py-0.5 text-[11px] font-semibold text-cart-accent">
                        📱 lo llevas tú
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-white/40">en el box</span>
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
                        className="-mr-1.5 grid size-9 place-items-center rounded-full text-red-400 transition hover:bg-red-500/15 hover:text-red-300 active:scale-95"
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
              <p className="text-[11.5px] text-red-400">No se pudo agregar. Reintenta.</p>
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
                className="rounded-full border border-cart-line px-4 py-2.5 text-[13px] font-semibold text-white/70"
              >
                Volver
              </button>
            </div>
            <p className="text-[11px] leading-snug text-white/45">
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
                <span className="block text-[11px] font-normal text-white/45">Llega solo y recibe su QR</span>
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
                <span className="block text-[11px] font-normal text-white/45">Su QR lo llevas tú</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode("closed")}
              className="w-full pt-1 text-center text-[12px] font-semibold text-white/45"
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
            <span className="text-[13.5px] font-semibold text-white/90">Agregar a alguien
              <span className="block text-[11px] font-normal text-white/45">
                {remaining === 1 ? "Queda 1 lugar" : `Quedan ${remaining} lugares`}
              </span>
            </span>
          </button>
        )
      )}
    </div>
  );
}

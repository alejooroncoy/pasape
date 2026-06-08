"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GoogleBtn, QrSquare } from "@/components/design";
import { useLocalRotatingQr } from "@/lib/tickets/hooks/useLocalRotatingQr";
import { useGoogleSignIn } from "@/lib/identity/hooks/useFirebaseAuth";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useBoxForTicket, useCreateBox } from "@/lib/boxes/hooks/useBoxes";

type Props = {
  ticketId: string;
  k: string;
  status: string;
  holderName: string | null;
  holderEmail: string | null;
  ticketTypeName: string;
  boxLabel: string | null;
  unitNoun: string | null;
  boxCapacity: number | null;
  isBoxHost: boolean;
  event: {
    slug: string;
    title: string;
    starts_at: string;
    venue: string | null;
    venue_url: string | null;
    timezone: string;
    cover_url: string | null;
  } | null;
};

const formatDate = (iso: string, tz: string): string => {
  try {
    const d = new Date(iso);
    const dayPart = new Intl.DateTimeFormat("es-PE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: tz,
    }).format(d);
    const timePart = new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(d);
    const pretty = dayPart.replace(/^./, (c) => c.toUpperCase()).replace(/\.$/, "");
    return `${pretty} · ${timePart}`;
  } catch {
    return iso;
  }
};

const formatLongDate = (iso: string, tz: string): string => {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const TicketView = ({
  ticketId,
  k,
  status,
  holderName,
  ticketTypeName,
  boxLabel,
  unitNoun,
  boxCapacity,
  isBoxHost,
  event,
}: Props) => {
  const activeTicketId = status === "active" ? ticketId : null;
  const { payload, secondsLeft, loading, error } = useLocalRotatingQr(
    activeTicketId,
    k,
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const { signIn, pending: signInPending, error: signInError } = useGoogleSignIn();
  const me = useCurrentUser();
  const isLogged = !!me.data?.user;

  // Si soy el host del box, busca el invite token. Si todavía no existe, lo
  // creamos automáticamente en background — el comprador no debería tener que
  // "activar" nada para invitar a su grupo, debe estar listo al cargar.
  const boxQuery = useBoxForTicket(isBoxHost && status === "active" ? ticketId : "", k);
  const box = boxQuery.data ?? null;
  const createBox = useCreateBox(k);
  useEffect(() => {
    if (!isBoxHost || status !== "active") return;
    if (boxQuery.isLoading || boxQuery.isPending) return;
    if (box) return;
    if (createBox.isPending || createBox.isSuccess) return;
    createBox.mutate({ ticketId, capacity: boxCapacity ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBoxHost, status, boxQuery.isLoading, boxQuery.isPending, box, ticketId, boxCapacity]);

  useEffect(() => {
    if (isLogged) setDrawerOpen(false);
  }, [isLogged]);

  const subTitle = boxLabel ?? ticketTypeName;
  const noun = (unitNoun?.trim() || "box").toLowerCase();

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-cart-bg text-white">
      {/* Ambient aurora — desktop only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 0%, rgba(124,58,237,0.28), transparent 60%), radial-gradient(50% 40% at 90% 30%, rgba(255,77,94,0.18), transparent 60%), radial-gradient(40% 30% at 50% 100%, rgba(124,58,237,0.18), transparent 60%)",
        }}
      />

      <header className="sticky top-0 z-30 border-b border-cart-line bg-cart-bg/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between px-5 py-3.5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]"
          >
            <span className="grid size-8 place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/logo-icon-min.svg"
                alt="Pasape"
                className="size-full object-contain drop-shadow-[0_2px_10px_rgba(184,124,255,0.35)]"
              />
            </span>
            <span>Pasape</span>
          </Link>
          <span className="text-[12.5px] font-medium text-cart-ink-3">Tu entrada</span>
          <span className="size-8" />
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-[960px] flex-col px-4 py-6 sm:px-6 lg:min-h-dvh lg:items-center lg:justify-center lg:py-12">
        {/* ============== Mobile (default, vertical) ============== */}
        <div className="w-full max-w-[440px] mx-auto lg:hidden">
          <TicketCard
            event={event}
            subTitle={subTitle}
            holderName={holderName}
            status={status}
            payload={payload}
            loading={loading}
            qrError={error}
            secondsLeft={secondsLeft}
            qrSize={220}
          />

          {/* Invita al grupo PRIMERO post-ticket. Si es box host, esto es lo
              más importante después del QR — no puede esperar a scrollear. */}
          {status === "active" && isBoxHost && (
            <InviteHostPane
              ticketId={ticketId}
              boxLabel={boxLabel ?? ""}
              noun={noun}
              capacity={boxCapacity}
              joinedCount={(box?.members.length ?? 0) + 1}
              inviteUrl={box ? `${typeof window !== "undefined" ? window.location.origin : ""}/box/${box.inviteToken}` : null}
              hostInitial={(holderName?.trim()[0] ?? "T").toUpperCase()}
              className="mt-4"
            />
          )}

          {status === "active" && <SecurityPill className="mt-4" />}

          {status === "active" && !isLogged && (
            <SignInPromo onOpen={() => setDrawerOpen(true)} className="mt-5" />
          )}
        </div>

        {/* ============== Desktop (lg+) — 2-col side by side ============== */}
        <div className="hidden w-full lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-6 lg:rounded-[28px] lg:border lg:border-cart-line lg:bg-cart-bg-elev/70 lg:p-6 lg:backdrop-blur-xl lg:shadow-[0_40px_120px_-30px_rgba(124,58,237,0.45)]">
          {/* IZQ — contexto del evento (secundario, estático) */}
          <div className="flex flex-col gap-4">
            <EventHeroPane event={event} subTitle={subTitle} />
            <EventInfoPane event={event} />
            {status === "active" && !isLogged && (
              <SignInPromoMini onOpen={() => setDrawerOpen(true)} />
            )}
          </div>
          {/* DER — acción del usuario: QR primero, invite segundo */}
          <div className="flex flex-col gap-4">
            <TicketCard
              event={null}
              subTitle={subTitle}
              holderName={holderName}
              status={status}
              payload={payload}
              loading={loading}
              qrError={error}
              secondsLeft={secondsLeft}
              qrSize={260}
              variant="desktop"
            />

            {status === "active" && <SecurityPill />}

            {status === "active" && isBoxHost && (
              <InviteHostPane
                ticketId={ticketId}
                boxLabel={boxLabel ?? ""}
                noun={noun}
                capacity={boxCapacity}
                joinedCount={(box?.members.length ?? 0) + 1}
                inviteUrl={box ? `${typeof window !== "undefined" ? window.location.origin : ""}/box/${box.inviteToken}` : null}
                hostInitial={(holderName?.trim()[0] ?? "T").toUpperCase()}
              />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <SignInDrawer
            onClose={() => setDrawerOpen(false)}
            onGoogle={() => void signIn()}
            pending={signInPending}
            error={signInError}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ============================== Subcomponents ============================== */

function TicketCard({
  event,
  subTitle,
  holderName,
  status,
  payload,
  loading,
  qrError,
  secondsLeft,
  qrSize,
  variant = "mobile",
}: {
  event: Props["event"] | null;
  subTitle: string;
  holderName: string | null;
  status: string;
  payload: string | null;
  loading: boolean;
  qrError: string | null;
  secondsLeft: number;
  qrSize: number;
  variant?: "mobile" | "desktop";
}) {
  return (
    <div
      className={
        "rounded-[28px] p-5 sm:p-6 " +
        (variant === "desktop"
          ? "bg-cart-bg-elev-2"
          : "bg-gradient-to-b from-[rgba(124,58,237,0.25)] to-[rgba(20,12,40,0.5)] shadow-[0_30px_60px_-20px_rgba(124,58,237,0.55)] ring-1 ring-cart-accent/45")
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
        Muestra en puerta
      </p>

      {event && (
        <div className="mt-1.5">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[24px]">
            {event.title}
          </h1>
          <p className="mt-1 text-[12.5px] text-cart-ink-3">
            {formatDate(event.starts_at, event.timezone)}
            {event.venue ? ` · ${event.venue}` : ""}
          </p>
        </div>
      )}

      <div
        className="relative mt-4 flex items-center justify-center rounded-[22px] bg-white p-5"
        style={{ minHeight: qrSize + 40 }}
      >
        {status === "active" && payload && <QrSquare code={payload} size={qrSize} />}
        {status === "active" && !payload && loading && (
          <p className="text-[13px] text-neutral-500">Generando QR…</p>
        )}
        {status === "active" && qrError && (
          <p className="px-3 text-center text-[13px] text-red-600">
            No pudimos generar el QR. Recarga.
          </p>
        )}
        {status !== "active" && (
          <p className="text-[14px] font-semibold text-neutral-500">
            Esta entrada ya no está activa.
          </p>
        )}

        {status === "active" && payload && <CountdownRing seconds={secondsLeft} />}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-cart-ink-3">
            {(holderName ?? "TITULAR").toUpperCase()}
          </p>
          <p className="mt-0.5 truncate text-[15px] font-semibold tracking-[-0.01em]">
            {subTitle}
          </p>
        </div>
        {status === "used" && (
          <span className="rounded-full bg-rose-500/18 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-rose-300">
            Ya usada
          </span>
        )}
      </div>
    </div>
  );
}

function EventHeroPane({
  event,
  subTitle,
}: {
  event: Props["event"] | null;
  subTitle: string;
}) {
  if (!event) return null;
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-cart-bg-elev-2 ring-1 ring-cart-line">
      {event.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.cover_url}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(140deg, #4B1F9A 0%, #7C3AED 40%, #FF4D5E 90%)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(60% 50% at 20% 30%, rgba(255,255,255,0.22), transparent 60%), radial-gradient(60% 50% at 80% 80%, rgba(0,0,0,0.55), transparent 60%)",
            }}
          />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">
          Tu entrada
        </p>
        <h1 className="mt-1.5 text-[24px] font-bold leading-tight tracking-[-0.02em] text-white">
          {event.title}
        </h1>
        <p className="mt-2 text-[12.5px] text-white/80">
          {formatLongDate(event.starts_at, event.timezone)}
        </p>
        {event.venue && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-white/65">
            <IconPin />
            <span>{event.venue}</span>
          </p>
        )}
        <div className="mt-3">
          <span className="inline-flex rounded-full bg-cart-accent/25 px-2.5 py-1 text-[11px] font-semibold text-cart-accent ring-1 ring-cart-accent/40">
            {subTitle}
          </span>
        </div>
      </div>
    </div>
  );
}

function EventInfoPane({ event }: { event: Props["event"] | null }) {
  if (!event) return null;
  const calendarUrl = buildGoogleCalendarUrl(event);
  return (
    <div className="rounded-[20px] border border-cart-line bg-cart-bg-elev-2/60 p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
        Detalles del evento
      </h3>
      <ul className="mt-3 flex flex-col gap-2.5 text-[13px]">
        <li className="flex items-start gap-2.5">
          <span className="mt-[3px] shrink-0 text-cart-accent"><IconCal /></span>
          <span className="text-white">
            {formatLongDate(event.starts_at, event.timezone)}
          </span>
        </li>
        {event.venue && (
          <li className="flex items-start gap-2.5">
            <span className="mt-[3px] shrink-0 text-cart-accent"><IconPin /></span>
            <span className="text-white">
              {event.venue_url ? (
                <a
                  href={event.venue_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  {event.venue}
                </a>
              ) : (
                event.venue
              )}
            </span>
          </li>
        )}
        <li className="flex items-start gap-2.5">
          <span className="mt-[3px] shrink-0 text-cart-accent"><IconTicket /></span>
          <a
            href={`/es/events/${event.slug}`}
            className="text-white underline-offset-2 hover:underline"
          >
            Ver página del evento
          </a>
        </li>
      </ul>
      <a
        href={calendarUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-cart-line bg-cart-bg-elev px-4 py-2.5 text-[13px] font-semibold text-white transition hover:border-cart-line-strong"
      >
        <CalendarPlusIcon />
        Agregar al calendario
      </a>
    </div>
  );
}

function InviteHostPane({
  boxLabel,
  noun,
  capacity,
  joinedCount,
  inviteUrl,
  hostInitial,
  className = "",
}: {
  ticketId: string;
  boxLabel: string;
  noun: string;
  capacity: number | null;
  joinedCount: number;
  inviteUrl: string | null;
  hostInitial?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const guests = capacity ?? 12;
  const friendsLeft = Math.max(0, guests - joinedCount);
  const ready = !!inviteUrl;

  const shareText = `Te invito al ${noun} ${boxLabel}. Reserva tu pase acá:`;

  const onWhatsApp = () => {
    if (!inviteUrl) return;
    const text = `${shareText} ${inviteUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  };

  return (
    <div
      className={
        "rounded-[24px] border border-cart-line bg-cart-bg-elev-2 p-5 sm:p-6 " +
        className
      }
    >
      {/* Headline emocional */}
      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-emerald-300">
        Tu grupo te espera
      </p>
      <h3 className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.02em] text-white sm:text-[24px]">
        Comparte tu {noun}, mándales su pase
      </h3>

      {/* Avatar slots — métrica visual instantánea */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {Array.from({ length: guests }).map((_, i) => {
          const filled = i < joinedCount;
          const isHost = i === 0;
          return (
            <span
              key={i}
              className={
                "relative grid size-9 place-items-center rounded-full text-[12px] font-bold transition " +
                (filled
                  ? "bg-emerald-400 text-emerald-950 shadow-[0_4px_12px_-4px_rgba(34,209,127,0.6)]"
                  : "border-2 border-dashed border-white/15 text-white/30")
              }
              aria-label={filled ? (isHost ? "Tú (host)" : "Invitado confirmado") : "Pase libre"}
            >
              {filled ? (
                isHost ? (hostInitial ?? "T") : (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )
              ) : (
                "+"
              )}
              {isHost && filled && (
                <span className="absolute -top-1.5 grid size-4 place-items-center rounded-full bg-cart-bg text-emerald-300 ring-2 ring-cart-bg">
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M1 3l2.5 2L6 1l2.5 4L11 3l-1 6H2L1 3z" />
                  </svg>
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Counter explicito */}
      <p className="mt-3 text-[13px] text-white">
        <span className="font-bold">{joinedCount}</span>
        <span className="text-cart-ink-3"> de </span>
        <span className="font-bold">{guests}</span>
        <span className="text-cart-ink-3"> confirmados</span>
        {friendsLeft > 0 && (
          <span className="text-cart-ink-3">
            {" "}· faltan {friendsLeft} {friendsLeft === 1 ? "amigo" : "amigos"}
          </span>
        )}
      </p>

      {/* CTA primario — WhatsApp gigante */}
      <button
        type="button"
        onClick={onWhatsApp}
        disabled={!ready}
        className={
          "mt-5 inline-flex w-full items-center justify-center gap-3 rounded-full px-5 py-4 text-[16px] font-bold transition active:scale-[0.98] " +
          (ready
            ? "bg-[#25D366] text-[#062b15] shadow-[0_16px_40px_-10px_rgba(37,211,102,0.6)] hover:brightness-105"
            : "animate-pulse cursor-wait bg-emerald-400/30 text-emerald-200/80")
        }
      >
        {ready ? (
          <>
            <WhatsAppIcon />
            Invitar por WhatsApp
          </>
        ) : (
          "Preparando link…"
        )}
      </button>

      {/* Copy link secundario */}
      <button
        type="button"
        onClick={onCopy}
        disabled={!ready}
        className="group mt-2.5 flex w-full items-center justify-between gap-2 rounded-full border border-cart-line bg-cart-bg-elev/60 px-4 py-2.5 text-left transition hover:border-cart-line-strong disabled:cursor-wait disabled:opacity-50"
      >
        <span className="truncate font-mono text-[11.5px] text-cart-ink-2">
          {ready ? inviteUrl?.replace(/^https?:\/\//, "") : "pasape.com/box/…"}
        </span>
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-300 transition group-hover:text-emerald-200">
          {copied ? "✓ Copiado" : "Copiar"}
        </span>
      </button>

      {/* Nota tranquilizadora */}
      <p className="mt-3.5 text-[11.5px] leading-relaxed text-cart-ink-3">
        Cada amigo recibe su propio QR al abrir el link. No tienen que llegar contigo.
      </p>
    </div>
  );
}

function SignInPromoMini({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev-2/40 px-4 py-3 text-left transition hover:border-cart-line-strong"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cart-accent/15 text-cart-accent">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-white">
          Guarda tu entrada en una cuenta
        </span>
        <span className="block text-[10.5px] text-cart-ink-3">
          Sin contraseña · sin apps
        </span>
      </span>
      <span className="shrink-0 text-cart-accent transition group-hover:translate-x-0.5">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function SecurityPill({ className = "" }: { className?: string }) {
  return (
    <div
      className={
        "flex items-center gap-3 rounded-2xl bg-cart-accent/18 px-3.5 py-3 text-[13px] ring-1 ring-cart-accent/45 " +
        className
      }
    >
      <ShieldIcon />
      <div className="leading-tight">
        <p className="font-semibold">Tu QR cambia cada 10 segundos</p>
        <p className="text-[11.5px] text-cart-ink-3">
          Las capturas no sirven en puerta — solo tu pantalla en vivo
        </p>
      </div>
    </div>
  );
}

function SignInPromo({
  onOpen,
  className = "",
}: {
  onOpen: () => void;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-[18px] border border-cart-line bg-cart-bg-elev-2 p-4 sm:p-5 " +
        className
      }
    >
      <h3 className="text-[15px] font-bold tracking-[-0.01em]">
        ¿Quieres tener tus entradas a la mano?
      </h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-cart-ink-3">
        Crea tu cuenta gratis y todas tus entradas se guardan automáticamente.
        Entras con tu celular — sin contraseña, sin apps.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3.5 w-full rounded-full bg-cart-accent px-4 py-3 text-[14px] font-bold text-cart-bg shadow-[0_12px_32px_-8px_var(--color-cart-accent-glow)] transition hover:brightness-110"
      >
        Crear mi cuenta
      </button>
    </div>
  );
}

/* ============================== SignInDrawer ============================== */

const SignInDrawer = ({
  onClose,
  onGoogle,
  pending,
  error,
}: {
  onClose: () => void;
  onGoogle: () => void;
  pending: boolean;
  error: string | null;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.18 }}
    onClick={onClose}
    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md lg:items-center"
  >
    <motion.div
      initial={{ y: "100%", opacity: 0.8 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 320, mass: 0.8 }}
      onClick={(e) => e.stopPropagation()}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 800) onClose();
      }}
      className="w-full max-w-[420px] touch-none rounded-t-[26px] bg-cart-bg-elev-2 p-5 pb-9 ring-1 ring-cart-line lg:rounded-[26px]"
    >
      <div className="mb-4 flex justify-center lg:hidden">
        <div className="h-1 w-9 rounded-full bg-white/15" />
      </div>
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.25 }}
        className="text-[24px] font-bold leading-tight tracking-[-0.03em]"
      >
        Crea tu cuenta
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.25 }}
        className="mb-5 mt-1.5 text-[13px] leading-relaxed text-cart-ink-3"
      >
        Un toque y todas tus entradas quedan guardadas.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <GoogleBtn onClick={onGoogle} disabled={pending} />
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden text-center text-[12px] text-rose-300"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <p className="mt-3.5 text-center text-[11px] text-cart-ink-4">
        Sin contraseña · sin apps
      </p>
    </motion.div>
  </motion.div>
);

/* ============================== Icons + ring ============================== */

function buildGoogleCalendarUrl(event: NonNullable<Props["event"]>): string {
  // Google Calendar acepta YYYYMMDDTHHmmssZ. Duración default 5h si no hay
  // ends_at (típico para evento nocturno).
  const start = new Date(event.starts_at);
  const end = new Date(start.getTime() + 5 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    location: event.venue ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const IconCal = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 6h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const IconPin = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M8 14s5-4.5 5-8.5A5 5 0 008 .5a5 5 0 00-5 5C3 9.5 8 14 8 14z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="8" cy="5.5" r="1.6" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const IconTicket = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M2 5a1 1 0 011-1h10a1 1 0 011 1v1.5a1.5 1.5 0 100 3V11a1 1 0 01-1 1H3a1 1 0 01-1-1V9.5a1.5 1.5 0 100-3V5z" stroke="currentColor" strokeWidth="1.4" />
    <path d="M9 5v6" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1.6 1.4" />
  </svg>
);

const CalendarPlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 6h12M5 1.5v3M11 1.5v3M8 8v4M6 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
  </svg>
);

const GroupIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M15 19c.3-2.4 2-3.5 4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="shrink-0">
    <path
      d="M11 2L3 5v5c0 4.5 3.2 8.5 8 10 4.8-1.5 8-5.5 8-10V5l-8-3Z"
      fill="rgba(124,58,237,0.18)"
      stroke="#7C3AED"
      strokeWidth="1.4"
    />
    <path
      d="M7.5 11l2.5 2.5L14.5 9"
      stroke="#7C3AED"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CountdownRing = ({ seconds }: { seconds: number }) => {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, (10 - seconds) / 10));
  const offset = circumference * progress;
  return (
    <div className="absolute -right-2.5 -top-2.5 grid size-12 place-items-center rounded-full bg-cart-bg shadow-[0_0_0_2px_var(--color-cart-bg-elev),0_8px_20px_rgba(0,0,0,0.4)]">
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
          stroke="#7C3AED"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: "drop-shadow(0 0 6px #7C3AED)",
            transition: "stroke-dashoffset 1s linear",
          }}
        />
      </svg>
      <span className="text-[14px] font-bold tracking-[-0.02em] text-cart-accent">
        {seconds}s
      </span>
    </div>
  );
};

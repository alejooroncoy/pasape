"use client";

import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import { formatDate } from "@/lib/_shared/format";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";

// Atajo del asistente logueado: su próxima salida arriba de la home, con acceso
// directo a la entrada — sin tener que entrar a "Mis entradas". Si no está
// logueado o no tiene entradas próximas, no renderiza nada.
//
// "Próxima" = entrada válida (active/used) de un evento que el backend NO marcó
// como closed/cancelled (status es la fuente de verdad). Entre esas, la de
// startsAt más cercano (orden de presentación).
export function NextEventHero() {
  const me = useCurrentUser();
  const tickets = useMyTickets();

  const loggedIn = !!me.data?.user;
  if (!loggedIn) return null;

  const next = pickNext(tickets.data ?? []);
  if (!next) return null;

  // Atajo solo el día del evento (hoy, en la zona del evento). Si es para otro
  // día, no lo mostramos — el usuario ya lo ve en "Mis entradas".
  if (!isSameDayInTz(next.event.startsAt, next.event.timezone)) return null;

  const when = countdownLabel(next.event.startsAt, next.event.timezone);

  return (
    // Atajo pensado para móvil; en desktop la navegación/contenido ya lo cubre.
    <section className="mx-auto w-full max-w-[1120px] px-4 pt-4 sm:px-6 lg:hidden">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[20px] border border-cart-line p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(115deg, rgba(124,58,237,0.12) 0%, rgba(79,109,245,0.08) 55%, rgba(124,58,237,0.04) 100%)",
        }}
      >
        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent/12 px-2.5 py-1 text-[10.5px] font-bold text-cart-accent">
            <span className="size-1.5 animate-pulse rounded-full bg-cart-accent" />
            Tu próxima salida
          </span>
          <span className="text-[12px] font-bold text-cart-accent">{when}</span>
        </div>

        <h2 className="relative mt-3 text-[24px] font-bold leading-[1.1] tracking-[-0.02em] text-cart-ink sm:text-[28px]">
          {next.event.title}
        </h2>
        <p className="relative mt-1.5 text-[13px] text-cart-ink-2">
          {formatDate(next.event.startsAt, next.event.timezone)}
          {next.event.venue ? ` · ${next.event.venue}` : ""}
        </p>

        <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-cart-line bg-cart-bg px-2.5 py-1 text-[11.5px] font-semibold text-cart-ink-2">
            {next.ticketType.name}
          </span>
          {next.boxLabel && (
            <span className="rounded-full border border-cart-accent/40 bg-cart-accent/12 px-2.5 py-1 font-mono text-[11.5px] font-semibold text-cart-accent">
              {next.boxLabel}
            </span>
          )}
        </div>

        <div className="relative mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href={`/tickets/${next.id}` as never}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cart-accent px-5 py-3 text-[14.5px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--color-cart-accent-glow-strong)] transition active:scale-[0.98]"
          >
            <QrIcon /> Ver mi entrada
          </Link>
          <Link
            href={"/tickets" as never}
            className="inline-flex items-center justify-center rounded-full border border-cart-line-strong bg-cart-bg px-5 py-3 text-[13.5px] font-semibold text-cart-ink-2 transition hover:text-cart-ink"
          >
            Todas mis entradas
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

// Entre las entradas del usuario, la próxima por mostrar. El backend decide el
// estado (closed/cancelled = fuera); aquí solo ordenamos por cercanía.
function pickNext(tickets: WalletTicket[]): WalletTicket | null {
  const candidates = tickets
    .filter((t) => t.status === "active" || t.status === "used")
    .filter((t) => t.event.status !== "closed" && t.event.status !== "cancelled")
    .sort(
      (a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime(),
    );
  return candidates[0] ?? null;
}

// ¿El evento es hoy? (mismo día de calendario en la zona del evento). Display:
// decide solo cuándo mostrar el atajo — el estado del evento lo sigue dando el
// backend (closed/cancelled se filtran en pickNext).
function isSameDayInTz(startsAt: string, timezone: string): boolean {
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  return dayKey(new Date()) === dayKey(new Date(startsAt));
}

// Etiqueta amigable de cuándo es (display). Cuando falta poco da precisión por
// horas/minutos (más útil que "Hoy" a secas); más allá de 24 h razona por días.
function countdownLabel(startsAt: string, timezone: string): string {
  const now = new Date();
  const start = new Date(startsAt);
  const diffMs = start.getTime() - now.getTime();
  const MIN = 60_000;
  const HOUR = 3_600_000;

  // Ya empezó (o está por empezar) pero el backend aún no lo cerró → es hoy.
  if (diffMs <= 0) return "¡Es hoy!";

  // Dentro de las próximas 24 h: contar horas / minutos.
  if (diffMs < 24 * HOUR) {
    if (diffMs < HOUR) {
      const mins = Math.max(1, Math.round(diffMs / MIN));
      return `En ${mins} ${mins === 1 ? "minuto" : "minutos"}`;
    }
    const hours = Math.round(diffMs / HOUR);
    return `En ${hours} ${hours === 1 ? "hora" : "horas"}`;
  }

  // Más de 24 h: razonar por días de calendario (en la zona del evento).
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const today = dayKey(now);
  const target = dayKey(start);
  const diffDays = Math.round(
    (new Date(`${target}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
      86400000,
  );
  if (diffDays <= 1) return "Mañana";
  if (diffDays < 7) return `En ${diffDays} días`;
  if (diffDays < 14) return "En una semana";
  return `En ${Math.round(diffDays / 7)} semanas`;
}

function QrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 2h4v4H2V2zM10 2h4v4h-4V2zM2 10h4v4H2v-4zM10 10h2v2h-2v-2zM13 13h1v1h-1v-1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

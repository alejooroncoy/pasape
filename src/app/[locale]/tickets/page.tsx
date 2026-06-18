"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import { useOnline } from "@/lib/_shared/useOnline";
import { formatDate } from "@/lib/_shared/format";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";
import { CATEGORY_BY_ID } from "../_home/categories";

// Gradiente de respaldo cuando el evento no tiene portada — tinta por categoría
// para dar variedad sin imagen.
function fallbackGradient(ticket: WalletTicket): string {
  const cat = ticket.event.category;
  if (cat && CATEGORY_BY_ID[cat]) return CATEGORY_BY_ID[cat].gradient;
  return "linear-gradient(150deg, rgba(124,58,237,0.55), rgba(124,58,237,0.12))";
}

// Hora corta para la jerarquía tipo Eventbrite (fecha + hora destacadas).
function shortTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

const isToday = (iso: string, tz: string): boolean => {
  const key = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return key(new Date(iso)) === key(new Date());
};

export default function WalletPage() {
  const tickets = useMyTickets();
  const online = useOnline();
  const router = useRouter();
  const [tab, setTab] = useState<"next" | "past">("next");

  const all = useMemo(() => tickets.data ?? [], [tickets.data]);

  const { upcoming, past } = useMemo(() => {
    const up: WalletTicket[] = [];
    const ps: WalletTicket[] = [];
    for (const t of all) {
      const eventDone = t.event.status === "closed" || t.event.status === "cancelled";
      if (t.status === "used" || t.status === "void" || t.status === "refunded" || eventDone) ps.push(t);
      else up.push(t);
    }
    up.sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime());
    ps.sort((a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime());
    return { upcoming: up, past: ps };
  }, [all]);

  const live = upcoming.find((t) => isToday(t.event.startsAt, t.event.timezone));
  const rest = upcoming.filter((t) => t.id !== live?.id);

  return (
    <div className="cart-grain relative min-h-screen bg-cart-bg font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[600px] w-[900px] -translate-x-1/2 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, rgba(184,124,255,0.18), transparent 70%)" }}
      />

      <div className="relative z-[1] mx-auto w-full max-w-[640px] px-4 pb-[96px] pt-[max(16px,env(safe-area-inset-top))] sm:px-6">
        {/* Aviso offline: las entradas se ven igual (guardadas en el device) */}
        {!online && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-[12px] text-amber-200">
            <span className="size-1.5 rounded-full bg-amber-400" />
            Sin conexión · mostramos tus entradas guardadas. Tu QR funciona igual.
          </div>
        )}

        {/* Header */}
        <header className="py-3">
          <p className="text-[12px] font-medium text-white/50">Mis entradas</p>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">
            {tab === "next"
              ? `${upcoming.length} próxima${upcoming.length === 1 ? "" : "s"}`
              : `${past.length} pasada${past.length === 1 ? "" : "s"}`}
          </h1>
        </header>

        {/* Tabs — píldora en móvil, subrayadas a la izquierda en desktop */}
        <div className="mt-1 flex gap-1 rounded-2xl bg-white/[0.04] p-1 shadow-[0_0_0_1px_var(--color-cart-line)_inset] lg:mt-2 lg:gap-7 lg:rounded-none lg:border-b lg:border-cart-line lg:bg-transparent lg:p-0 lg:shadow-none">
          <TabBtn label="Próximas" count={upcoming.length} on={tab === "next"} onClick={() => setTab("next")} />
          <TabBtn label="Pasadas" count={past.length} on={tab === "past"} onClick={() => setTab("past")} />
        </div>

        {tickets.isLoading && (
          <div className="flex flex-col gap-3 pt-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        )}

        {!tickets.isLoading && all.length === 0 && <EmptyState />}

        {/* Próximas */}
        {!tickets.isLoading && tab === "next" && upcoming.length > 0 && (
          <div className="pt-5">
            {live && (
              <>
                <SectionLabel>Esta noche</SectionLabel>
                <LiveCard ticket={live} onClick={() => router.push(`/tickets/${live.id}` as never)} />
              </>
            )}
            {rest.length > 0 && (
              <>
                <SectionLabel className={live ? "mt-6" : ""}>Próximas</SectionLabel>
                <div className="flex flex-col gap-2.5">
                  {rest.map((t) => (
                    <TicketRow key={t.id} ticket={t} onClick={() => router.push(`/tickets/${t.id}` as never)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Pasadas */}
        {!tickets.isLoading && tab === "past" && (
          <div className="pt-5">
            {past.length === 0 ? (
              <p className="py-12 text-center text-[13.5px] text-white/40">Aún no hay entradas pasadas.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {past.map((t) => (
                  <TicketRow key={t.id} ticket={t} past onClick={() => router.push(`/tickets/${t.id}` as never)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ label, count, on, onClick }: { label: string; count: number; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13.5px] font-semibold transition " +
        "lg:flex-none lg:justify-start lg:rounded-none lg:px-0 lg:pb-3 lg:pt-1 lg:-mb-px lg:border-b-2 " +
        (on
          ? "bg-cart-accent text-white shadow-[0_8px_24px_-12px_var(--color-cart-accent-glow)] lg:bg-transparent lg:text-white lg:shadow-none lg:border-cart-accent"
          : "text-white/55 hover:text-white lg:border-transparent")
      }
    >
      {label}
      <span
        className={
          "rounded-full px-1.5 py-px text-[10.5px] font-bold " +
          (on ? "bg-white/20 lg:bg-cart-accent/20 lg:text-cart-accent" : "bg-white/8 text-white/50")
        }
      >
        {count}
      </span>
    </button>
  );
}

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={"mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45 " + className}>{children}</p>
  );
}

// Card destacada para la entrada de hoy — portada del evento a sangre + overlay.
function LiveCard({ ticket, onClick }: { ticket: WalletTicket; onClick: () => void }) {
  const cover = ticket.event.coverUrl;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className="relative block w-full overflow-hidden rounded-[24px] border border-cart-accent/30 text-left shadow-[0_24px_60px_-24px_rgba(124,58,237,0.7)]"
    >
      <div className="relative h-[230px] w-full sm:h-[260px]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: fallbackGradient(ticket) }} />
        )}
        {/* Oscurecido inferior para legibilidad del texto */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/45 to-black/20" />

        {/* Fila superior: estado + acción */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md">
            <span className="size-1.5 animate-pulse rounded-full bg-cart-accent" /> Es hoy
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-cart-accent px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)]">
            Mostrar QR
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        {/* Info inferior */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            {ticket.event.title}
          </h3>
          <p className="mt-1 text-[12.5px] text-white/85">
            {shortTime(ticket.event.startsAt, ticket.event.timezone)}
            {ticket.event.venue ? ` · ${ticket.event.venue}` : ""}
          </p>
          <div className="mt-2.5 flex items-center gap-1.5">
            <Chip>{ticket.ticketType.name}</Chip>
            {ticket.boxLabel && <Chip accent>{ticket.boxLabel}</Chip>}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// Fila de entrada (próxima o pasada) — thumbnail de portada + info.
function TicketRow({ ticket, onClick, past = false }: { ticket: WalletTicket; onClick: () => void; past?: boolean }) {
  const cover = ticket.event.coverUrl;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      className={
        "flex w-full items-stretch overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev text-left transition hover:border-white/20 " +
        (past ? "opacity-70" : "")
      }
    >
      {/* Portada */}
      <div className="relative w-[88px] shrink-0 sm:w-[104px]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className={"absolute inset-0 size-full object-cover " + (past ? "grayscale" : "")} />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[20px] font-bold text-white/90" style={{ background: fallbackGradient(ticket) }}>
            {ticket.event.title.charAt(0).toUpperCase()}
          </div>
        )}
        {/* Punto de estado: válida (verde) / pasada (gris) */}
        <span
          className={
            "absolute left-2 top-2 size-2 rounded-full ring-2 ring-black/40 " +
            (past ? "bg-white/40" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]")
          }
        />
      </div>

      {/* Troquel: notch + línea punteada, como un ticket real */}
      <div className="relative w-0 shrink-0">
        <span className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-cart-bg" />
        <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-cart-bg" />
        <span className="absolute inset-y-2 left-1/2 -translate-x-1/2 border-l border-dashed border-white/15" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-cart-accent">
            {formatDate(ticket.event.startsAt, ticket.event.timezone)}
          </p>
          <p className="truncate text-[15px] font-semibold leading-tight">{ticket.event.title}</p>
          {ticket.event.venue && (
            <p className="mt-0.5 truncate text-[12px] text-white/55">{ticket.event.venue}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip small>{ticket.ticketType.name}</Chip>
            {ticket.boxLabel && <Chip small accent>{ticket.boxLabel}</Chip>}
            {!past && ticket.pendingTransferTo && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-300">
                <span className="size-1.5 rounded-full bg-amber-400" /> Enviada · esperando
              </span>
            )}
            {past && <span className="text-[11px] text-white/40">· {ticket.status === "used" ? "usada" : "finalizada"}</span>}
          </div>
        </div>
        {!past && (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-white/30">
            <path d="M7 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </motion.button>
  );
}

function Chip({ children, accent = false, small = false }: { children: React.ReactNode; accent?: boolean; small?: boolean }) {
  return (
    <span
      className={
        (small ? "px-2 py-0.5 text-[10.5px] " : "px-2.5 py-1 text-[11.5px] ") +
        "rounded-full font-medium " +
        (accent
          ? "border border-cart-accent/40 bg-cart-accent/15 font-mono font-semibold text-cart-accent"
          : "border border-white/12 bg-white/5 text-white/75")
      }
    >
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <div
        className="mb-5 grid size-20 place-items-center rounded-3xl"
        style={{ background: "linear-gradient(150deg, rgba(124,58,237,0.35), rgba(124,58,237,0.08))" }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="text-white">
          <path
            d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M14 7v10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      </div>
      <h2 className="text-[19px] font-bold tracking-[-0.01em]">Aún no tienes entradas</h2>
      <p className="mt-1.5 max-w-[260px] text-[13.5px] text-white/55">
        Cuando compres una, aparecerá aquí lista para mostrar en la puerta.
      </p>
      <Link
        href={"/" as never}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-cart-accent px-6 py-3 text-[14.5px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--color-cart-accent-glow-strong)] transition active:scale-95"
      >
        Explorar eventos
      </Link>
    </div>
  );
}

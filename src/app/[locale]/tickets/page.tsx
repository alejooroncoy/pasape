"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Link, useRouter } from "@/i18n/navigation";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { LoginGate } from "@/components/ui/LoginGate";
import { useOnline } from "@/lib/_shared/useOnline";
import { formatDate } from "@/lib/_shared/format";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";
import { CATEGORY_BY_ID } from "../_home/categories";

function fallbackGradient(ticket: WalletTicket): string {
  const cat = ticket.event.category;
  if (cat && CATEGORY_BY_ID[cat]) return CATEGORY_BY_ID[cat].gradient;
  return "linear-gradient(150deg, rgba(124,58,237,0.55), rgba(124,58,237,0.12))";
}

function shortDateTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const isToday = (iso: string, tz: string): boolean => {
  const key = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return key(new Date(iso)) === key(new Date());
};

type EventGroup = {
  event: WalletTicket["event"];
  tickets: WalletTicket[];
};

function groupByEvent(tickets: WalletTicket[]): EventGroup[] {
  const map = new Map<string, EventGroup>();
  for (const t of tickets) {
    if (!map.has(t.event.id)) map.set(t.event.id, { event: t.event, tickets: [] });
    map.get(t.event.id)!.tickets.push(t);
  }
  return [...map.values()];
}

// ── Paso 1: card de evento en la lista ────────────────────────────────────
function EventCard({
  group,
  past,
  onClick,
}: {
  group: EventGroup;
  past: boolean;
  onClick: () => void;
}) {
  const { event, tickets } = group;
  const cover = event.coverUrl;
  const today = isToday(event.startsAt, event.timezone);
  // El box no es "una entrada": lo nombramos aparte para no contar "1 entrada"
  // cuando en realidad compraste un box. (listMine ya entrega un box por entrada.)
  const boxTicket = tickets.find((t) => t.boxLabel);
  const singles = tickets.filter((t) => !t.boxLabel);
  const countLabel = boxTicket
    ? singles.length > 0
      ? `${boxTicket.boxLabel} · ${singles.length} ${singles.length === 1 ? "entrada" : "entradas"}`
      : (boxTicket.boxLabel as string)
    : `${tickets.length} ${tickets.length === 1 ? "entrada" : "entradas"}`;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={
        "flex w-full items-stretch overflow-hidden rounded-2xl border text-left transition " +
        (today
          ? "border-cart-accent/40 shadow-[0_8px_32px_-16px_rgba(124,58,237,0.5)]"
          : "border-cart-line bg-cart-bg-elev hover:border-white/20")
      }
    >
      {/* Cover */}
      <div className="relative w-[88px] shrink-0 sm:w-[100px]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className={"absolute inset-0 size-full object-cover " + (past ? "grayscale" : "")}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: tickets[0] ? fallbackGradient(tickets[0]) : "rgba(124,58,237,0.3)" }}
          />
        )}
        {today && (
          <div className="absolute inset-0 flex items-end p-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-cart-accent/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              <span className="size-1 animate-pulse rounded-full bg-white" /> Hoy
            </span>
          </div>
        )}
        {!today && (
          <span
            className={
              "absolute left-2 top-2 size-2 rounded-full ring-2 ring-black/40 " +
              (past ? "bg-white/30" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]")
            }
          />
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-3.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-cart-accent">
          {countLabel}
        </p>
        <p className="truncate text-[15px] font-bold leading-tight">{event.title}</p>
        {event.venue && <p className="truncate text-[12px] text-white/45">{event.venue}</p>}
        <p className="mt-0.5 text-[11px] text-white/30">{formatDate(event.startsAt, event.timezone)}</p>
      </div>

      {/* Chevron */}
      <div className="flex items-center pr-4">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M7 5l5 5-5 5" stroke="white" strokeOpacity="0.25" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </motion.button>
  );
}

// ── Paso 2: lista de entradas del evento ──────────────────────────────────
function TicketSelectScreen({
  group,
  past,
  highlightId,
  onBack,
  onSelect,
}: {
  group: EventGroup;
  past: boolean;
  highlightId?: string | null;
  onBack: () => void;
  onSelect: (ticket: WalletTicket) => void;
}) {
  const { event, tickets } = group;
  const cover = event.coverUrl;
  // El box es otra categoría: va en su propia sección, no mezclado/numerado con
  // las entradas individuales. El backend (listMine) ya entrega un box por
  // entrada — los QR de acompañantes que el host carga no vienen acá —, así que
  // el frontend solo separa por presentación.
  const boxTickets = tickets.filter((t) => t.boxLabel);
  const singles = tickets.filter((t) => !t.boxLabel);

  return (
    <motion.div
      key="select"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.18 }}
    >
      {/* Back + evento */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-[12.5px] text-white/45 transition hover:text-white/70"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path d="M13 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Mis entradas
      </button>

      {/* Header del evento */}
      <div className="mb-5 flex items-center gap-3">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className={"size-14 rounded-xl object-cover " + (past ? "grayscale" : "")} />
        ) : (
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-xl text-[20px] font-black text-white/80"
            style={{ background: tickets[0] ? fallbackGradient(tickets[0]) : "rgba(124,58,237,0.3)" }}
          >
            {event.title.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold">{event.title}</p>
          <p className="text-[12px] text-white/40">{shortDateTime(event.startsAt, event.timezone)}</p>
          {event.venue && <p className="truncate text-[11.5px] text-white/30">{event.venue}</p>}
        </div>
      </div>

      {/* Sección BOX: se ve distinto de una entrada suelta */}
      {boxTickets.length > 0 && (
        <>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">
            Tu box
          </p>
          <div className="mb-5 flex flex-col gap-2">
            {boxTickets.map((t) => {
              const isFrom = t.id === highlightId;
              const active = !past && t.status === "active";
              const label = /^box\b/i.test((t.boxLabel ?? "").trim())
                ? (t.boxLabel as string)
                : `Box ${t.boxLabel}`;
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelect(t)}
                  className={
                    "relative flex w-full items-center gap-3.5 rounded-2xl border px-4 py-4 text-left transition " +
                    (isFrom
                      ? "border-cart-accent bg-cart-accent/[0.16] shadow-[0_0_0_1px_var(--color-cart-accent)_inset]"
                      : "border-cart-accent/60 bg-cart-accent/[0.08] hover:border-cart-accent")
                  }
                >
                  <span className="absolute right-3 top-3 rounded-full bg-cart-accent px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-cart-bg">
                    Tu box
                  </span>
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-black/25 text-cart-accent">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="8" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                      <circle cx="16" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M3 18c0-2.5 2.2-4 5-4s5 1.5 5 4M13 17.5c.3-2.2 2.2-3.5 4.5-3.5s3.5 1.2 4.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold leading-tight">{label}</p>
                    <p className="mt-0.5 text-[12px] text-white/55">Tu entrada + invitados</p>
                    {active && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/12 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                        <span className="size-1.5 rounded-full bg-emerald-400" /> Ya puedes entrar
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </>
      )}

      {/* Sección ENTRADAS individuales */}
      {singles.length > 0 && (
        <>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">
            {boxTickets.length > 0 ? "Tus entradas individuales" : "Seleccioná tu entrada"}
          </p>
          <div className="flex flex-col gap-2">
            {singles.map((t, i) => {
              const unassigned = !past && t.status === "active" && !t.holderName && !t.pendingTransferTo;
              const isFrom = t.id === highlightId;
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelect(t)}
                  className={
                    "flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition " +
                    (isFrom
                      ? "border-cart-accent bg-cart-accent/[0.12] shadow-[0_0_0_1px_var(--color-cart-accent)_inset]"
                      : "border-cart-line bg-cart-bg-elev hover:border-cart-accent/40 hover:bg-cart-accent/[0.04]")
                  }
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[15px] font-black text-white/60">
                    {i + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold">{t.ticketType.name}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span
                        className={
                          "size-1.5 rounded-full " +
                          (past ? "bg-white/30" : t.status === "active" ? "bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]" : "bg-amber-400")
                        }
                      />
                      <span className="text-[12px] text-white/40">
                        {t.pendingTransferTo
                          ? "Enviada · esperando"
                          : past
                            ? t.status === "used"
                              ? "Usada"
                              : "Finalizada"
                            : unassigned
                              ? "Sin asignar"
                              : t.holderName ?? (t.status === "active" ? "Válida · 1 persona" : t.status)}
                      </span>
                    </div>
                  </div>

                  {/* QR icon */}
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-white/20">
                    <rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.4" />
                    <rect x="11" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.4" />
                    <rect x="2" y="11" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.4" />
                    <rect x="12" y="12" width="2" height="2" fill="currentColor" />
                    <rect x="16" y="12" width="2" height="2" fill="currentColor" />
                    <rect x="12" y="16" width="2" height="2" fill="currentColor" />
                    <rect x="16" y="16" width="2" height="2" fill="currentColor" />
                  </svg>
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
export default function WalletPage() {
  const tickets = useMyTickets();
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const online = useOnline();
  const router = useRouter();
  const [tab, setTab] = useState<"next" | "past">("next");

  // "list" → muestra la lista de eventos
  // "select" → muestra las entradas de un evento
  const [view, setView] = useState<"list" | "select">("list");
  const [activeGroup, setActiveGroup] = useState<EventGroup | null>(null);

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

  const upcomingGroups = useMemo(() => groupByEvent(upcoming), [upcoming]);
  const pastGroups = useMemo(() => groupByEvent(past), [past]);

  // Deep-link "Ver todas" desde el QR: /tickets?event=<id> abre directo la lista
  // de entradas de ese evento (vista "select"), sin pasar por elegir el evento.
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event");
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !eventParam || all.length === 0) return;
    const group =
      groupByEvent(upcoming).find((g) => g.event.id === eventParam) ??
      groupByEvent(past).find((g) => g.event.id === eventParam);
    if (!group) return;
    autoOpened.current = true;
    setTab(past.some((t) => t.event.id === eventParam) && !upcoming.some((t) => t.event.id === eventParam) ? "past" : "next");
    setActiveGroup(group);
    setView("select");
  }, [eventParam, all.length, upcoming, past]);

  const currentGroups = tab === "next" ? upcomingGroups : pastGroups;

  // Agrupar por mes para el label de sección
  const groupedByMonth = useMemo(() => {
    const months = new Map<string, EventGroup[]>();
    for (const g of currentGroups) {
      const label = new Intl.DateTimeFormat("es-PE", {
        month: "long",
        year: "numeric",
        timeZone: g.event.timezone,
      }).format(new Date(g.event.startsAt));
      const key = label.charAt(0).toUpperCase() + label.slice(1);
      if (!months.has(key)) months.set(key, []);
      months.get(key)!.push(g);
    }
    return [...months.entries()];
  }, [currentGroups]);

  // Sincroniza la vista "select" con la URL (?event=) de forma cosmética, para
  // que recargar o volver no la pierda.
  const syncEventParam = (eventId: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (eventId) url.searchParams.set("event", eventId);
    else {
      url.searchParams.delete("event");
      url.searchParams.delete("from");
    }
    window.history.replaceState(window.history.state, "", url.toString());
  };

  const handleSelectEvent = (group: EventGroup) => {
    // Si solo tiene 1 entrada, ir directo al QR
    if (group.tickets.length === 1) {
      router.push(`/tickets/${group.tickets[0].id}` as never);
      return;
    }
    setActiveGroup(group);
    setView("select");
    syncEventParam(group.event.id);
  };

  const handleBack = () => {
    setView("list");
    setActiveGroup(null);
    syncEventParam(null);
  };

  const handleSelectTicket = (ticket: WalletTicket) => {
    router.push(`/tickets/${ticket.id}` as never);
  };

  if (!meLoading && !me?.user) {
    return (
      <LoginGate
        title="Inicia sesión para ver tus entradas"
        subtitle="Tus entradas y QR viven en tu cuenta. Inicia sesión para verlas y mostrarlas en la puerta."
        next="/tickets"
      />
    );
  }

  return (
    <div className="cart-grain relative min-h-screen bg-cart-bg font-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[600px] w-[900px] -translate-x-1/2 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, rgba(184,124,255,0.18), transparent 70%)" }}
      />

      <div className="relative z-[1] mx-auto w-full max-w-[640px] px-4 pb-[96px] pt-[max(16px,env(safe-area-inset-top))] sm:px-6">
        {!online && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-[12px] text-amber-200">
            <span className="size-1.5 rounded-full bg-amber-400" />
            Sin conexión · mostramos tus entradas guardadas. Tu QR funciona igual.
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "list" ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
            >
              {/* Header */}
              <header className="py-3">
                <p className="text-[12px] font-medium text-white/50">Mis entradas</p>
                <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em]">
                  {currentGroups.length === 0
                    ? "Sin eventos"
                    : `${currentGroups.length} evento${currentGroups.length === 1 ? "" : "s"}`}
                </h1>
              </header>

              {/* Tabs */}
              <div className="mt-1 flex gap-1 rounded-2xl bg-white/[0.04] p-1 shadow-[0_0_0_1px_var(--color-cart-line)_inset] lg:mt-2 lg:gap-7 lg:rounded-none lg:border-b lg:border-cart-line lg:bg-transparent lg:p-0 lg:shadow-none">
                <TabBtn label="Próximas" count={upcomingGroups.length} on={tab === "next"} onClick={() => setTab("next")} />
                <TabBtn label="Pasadas" count={pastGroups.length} on={tab === "past"} onClick={() => setTab("past")} />
              </div>

              {/* Skeletons */}
              {tickets.isLoading && (
                <div className="flex flex-col gap-3 pt-5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-white/[0.04]" />
                  ))}
                </div>
              )}

              {/* Vacío */}
              {!tickets.isLoading && all.length === 0 && <EmptyState />}

              {/* Lista agrupada por mes */}
              {!tickets.isLoading && currentGroups.length > 0 && (
                <div className="pt-5">
                  {groupedByMonth.map(([month, groups]) => (
                    <div key={month} className="mb-6">
                      <p className="mb-2.5 text-[12px] font-semibold tracking-wide text-white/40">{month}</p>
                      <div className="flex flex-col gap-2.5">
                        {groups.map((g) => (
                          <EventCard
                            key={g.event.id}
                            group={g}
                            past={tab === "past"}
                            onClick={() => handleSelectEvent(g)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!tickets.isLoading && tab === "past" && pastGroups.length === 0 && (
                <p className="py-12 text-center text-[13.5px] text-white/40">Aún no hay entradas pasadas.</p>
              )}
            </motion.div>
          ) : (
            activeGroup && (
              <motion.div
                key="select"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pt-[max(16px,env(safe-area-inset-top))]"
              >
                <TicketSelectScreen
                  group={activeGroup}
                  past={tab === "past"}
                  highlightId={searchParams.get("from")}
                  onBack={handleBack}
                  onSelect={handleSelectTicket}
                />
              </motion.div>
            )
          )}
        </AnimatePresence>
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

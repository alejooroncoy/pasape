"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Send, Pencil } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import { usePrefetchWallet } from "@/lib/tickets/prefetchWallet";
import { useSessionReady } from "@/lib/identity/hooks/useSessionReady";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMarkTicketNotificationsRead } from "@/lib/identity/hooks/useNotifications";
import { useBoxForTicket } from "@/lib/boxes/hooks/useBoxes";
import { LoginGate } from "@/components/ui/LoginGate";
import { Sheet } from "@/components/ui/Sheet";
import { TransferTicketSheet } from "@/components/tickets/TransferTicketSheet";
import { HolderEditSheet } from "@/components/tickets/HolderEditSheet";
import { useOnline } from "@/lib/_shared/useOnline";
import { formatDate, eventDatePillParts } from "@/lib/_shared/format";
import { optimizeImageUrl } from "@/lib/images/optimizeUrl";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";
import { CATEGORY_BY_ID } from "../_home/categories";

function fallbackGradient(ticket: WalletTicket): string {
  const cat = ticket.event.category;
  if (cat && CATEGORY_BY_ID[cat]) return CATEGORY_BY_ID[cat].gradient;
  return "linear-gradient(150deg, rgba(124,58,237,0.55), rgba(124,58,237,0.12))";
}

// Avatares: color plano sólido derivado del nombre (estilo Google Contactos),
// no gradientes — los degradados arcoíris se leían como plantilla de IA. La misma
// persona sale siempre del mismo color (determinístico, sin estado).
const AVATAR_COLORS = [
  "#1a73e8", // azul
  "#d93025", // rojo
  "#188038", // verde
  "#e37400", // ámbar
  "#8430ce", // morado
  "#12805c", // teal
  "#c2185b", // rosa
  "#3949ab", // índigo
];
function avatarColorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function cap(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

// "Box A" a partir del label crudo ("A" → "Box A"; "Box B" → "Box B").
function boxNameOf(label: string): string {
  const t = label.trim();
  return /^box\b/i.test(t) ? t : `Box ${t}`;
}

// "Sáb 11 jul · 10:00 PM" — línea humana de cuándo, sin puntos raros de Intl.
function compactWhen(iso: string, tz: string): string {
  const p = eventDatePillParts(iso, tz);
  return `${cap(p.weekday)} ${Number(p.day)} ${p.month.charAt(0) + p.month.slice(1).toLowerCase()} · ${p.time}`;
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

// "Box A · 21 entradas" / "3 entradas" — habla de personas, no de filas de DB.
// El box no es "una entrada": se nombra aparte para no contar "1 entrada" cuando
// en realidad es un box. (listMine ya entrega un box por entrada.)
function holdingLabel(tickets: WalletTicket[]): string {
  const boxTicket = tickets.find((t) => t.boxLabel);
  const singles = tickets.filter((t) => !t.boxLabel);
  const boxName = boxTicket ? boxNameOf(boxTicket.boxLabel as string) : null;
  const singlesLabel =
    singles.length > 0 ? `${singles.length} ${singles.length === 1 ? "entrada" : "entradas"}` : null;
  if (boxName) return singlesLabel ? `${boxName} · ${singlesLabel}` : boxName;
  return `${tickets.length} ${tickets.length === 1 ? "entrada" : "entradas"}`;
}

// ── Título de sección con punto de acento ("Boxes.") — firma Pasape ──────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 mt-6 px-0.5 text-[19px] font-extrabold tracking-[-0.02em] text-cart-ink first:mt-0">
      {children}
      <span className="text-cart-accent">.</span>
    </h2>
  );
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 px-0.5 text-[12.5px] font-semibold text-cart-ink-3">{children}</p>;
}

// ── Nivel 1: hero del próximo evento (FlyerCard variante "ticket") ───────────
// Adaptación del FlyerCard del detalle de evento (blur-fill + póster + perforación
// + talón) para la wallet: el talón dice qué tienes y el pie abre las entradas.
function TicketHeroCard({ group, onOpen }: { group: EventGroup; onOpen: () => void }) {
  const { event, tickets } = group;
  const [imgFailed, setImgFailed] = useState(false);
  const cover = event.coverUrl && !imgFailed ? event.coverUrl : null;
  const today = isToday(event.startsAt, event.timezone);
  const dt = eventDatePillParts(event.startsAt, event.timezone);
  const gradient = tickets[0] ? fallbackGradient(tickets[0]) : "linear-gradient(140deg,#4B1F9A,#7C3AED 40%,#FF4D5E 90%)";

  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-cart-line bg-cart-bg-elev shadow-[0_1px_2px_rgba(20,10,60,0.05),0_18px_44px_-24px_rgba(20,10,60,0.35)]">
      {/* Fondo limpio (sin blur): solo gradiente de marca cuando no hay flyer */}
      {!cover && <div className="absolute inset-0" style={{ background: gradient }} />}

      {/* Póster completo (object-contain) — nunca se recorta */}
      <button type="button" onClick={onOpen} className="relative block w-full text-left">
        <div className={"relative w-full " + (cover ? "" : "aspect-[16/10]")}>
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={optimizeImageUrl(cover, "event-hero") ?? cover}
              alt={event.title}
              width={864}
              height={1080}
              onError={() => setImgFailed(true)}
              className="relative z-[1] mx-auto my-6 block h-auto max-h-[44vh] w-auto max-w-[calc(100%-3rem)] rounded-[18px] object-contain"
              style={{ filter: "drop-shadow(0 10px 26px rgba(40,20,90,0.22))" }}
            />
          )}
        </div>
      </button>

      {/* Talón: perforación + título + fecha + qué tienes */}
      <div className="relative">
        <span className="absolute left-0 top-0 z-[2] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cart-bg" />
        <span className="absolute right-0 top-0 z-[2] size-4 -translate-y-1/2 translate-x-1/2 rounded-full bg-cart-bg" />
        <span className="absolute inset-x-4 top-0 -translate-y-1/2 border-t-2 border-dashed border-cart-line-strong" />
        <button
          type="button"
          onClick={onOpen}
          className="block w-full px-5 py-4 text-left"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--color-cart-accent) 6%, var(--color-cart-bg-elev)) 0%, var(--color-cart-bg-elev) 100%)",
          }}
        >
          <h3 className="text-[21px] font-bold leading-[1.12] tracking-[-0.02em] text-cart-ink">{event.title}</h3>
          <div className="mt-3 flex items-center gap-4">
            <div className="text-center leading-none">
              <div className="text-[25px] font-extrabold tracking-[-0.03em] text-cart-ink">{dt.day}</div>
              <div className="mt-1 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-cart-accent">{dt.month}</div>
            </div>
            <div className="h-9 w-px bg-cart-line-strong" />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold tracking-[-0.01em] text-cart-ink">
                {cap(dt.weekday)} · {dt.time}
              </div>
              {event.venue && <div className="mt-0.5 truncate text-[11.5px] text-cart-ink-3">{event.venue}</div>}
            </div>
            {today && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-white" /> Hoy
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[13px] font-bold text-cart-ink-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-cart-ink-4">Tienes</span>
            {holdingLabel(tickets)}
          </div>
        </button>
      </div>

      {/* Pie tappable: SOLO la acción, sin competir */}
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between border-t border-cart-line bg-cart-bg-elev px-5 py-3.5 text-[14.5px] font-extrabold tracking-[-0.01em] text-cart-accent transition active:scale-[0.99]"
      >
        <span>Ver mis entradas</span>
        <span>→</span>
      </button>
    </div>
  );
}

// ── Skeleton del hero (misma silueta que TicketHeroCard, sin datos) ──────────
function TicketHeroCardSkeleton() {
  return (
    <div className="relative w-full overflow-hidden rounded-[24px] border border-cart-line bg-cart-bg-elev shadow-[0_1px_2px_rgba(20,10,60,0.05),0_18px_44px_-24px_rgba(20,10,60,0.35)]">
      {/* Póster */}
      <div className="flex justify-center py-6">
        <div className="h-[260px] w-[200px] max-w-[calc(100%-3rem)] animate-pulse rounded-[18px] bg-cart-bg-elev-2" />
      </div>

      {/* Talón: misma perforación que el real, título + fecha + "tienes" en gris */}
      <div className="relative">
        <span className="absolute left-0 top-0 z-[2] size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cart-bg" />
        <span className="absolute right-0 top-0 z-[2] size-4 -translate-y-1/2 translate-x-1/2 rounded-full bg-cart-bg" />
        <span className="absolute inset-x-4 top-0 -translate-y-1/2 border-t-2 border-dashed border-cart-line-strong" />
        <div className="px-5 py-4">
          <div className="h-5 w-3/4 animate-pulse rounded bg-cart-bg-elev-2" />
          <div className="mt-3 flex items-center gap-4">
            <div className="space-y-1.5 text-center">
              <div className="mx-auto h-6 w-7 animate-pulse rounded bg-cart-bg-elev-2" />
              <div className="mx-auto h-2.5 w-6 animate-pulse rounded bg-cart-bg-elev-2" />
            </div>
            <div className="h-9 w-px bg-cart-line-strong" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-28 animate-pulse rounded bg-cart-bg-elev-2" />
              <div className="h-3 w-20 animate-pulse rounded bg-cart-bg-elev-2" />
            </div>
          </div>
          <div className="mt-3 h-3.5 w-32 animate-pulse rounded bg-cart-bg-elev-2" />
        </div>
      </div>

      {/* Pie */}
      <div className="flex w-full items-center justify-between border-t border-cart-line bg-cart-bg-elev px-5 py-3.5">
        <div className="h-4 w-28 animate-pulse rounded bg-cart-bg-elev-2" />
        <div className="h-4 w-4 animate-pulse rounded bg-cart-bg-elev-2" />
      </div>
    </div>
  );
}

// ── Nivel 1: fila compacta de otro evento ────────────────────────────────────
function EventMiniRow({ group, past, onClick }: { group: EventGroup; past: boolean; onClick: () => void }) {
  const { event, tickets } = group;
  const cover = event.coverUrl;
  const today = isToday(event.startsAt, event.timezone);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="mb-2.5 flex w-full items-center gap-3 rounded-[18px] border border-cart-line bg-white p-2.5 text-left shadow-[0_1px_2px_rgba(20,10,60,0.04)] transition hover:border-cart-line-strong"
    >
      <div className="relative size-[58px] shrink-0 overflow-hidden rounded-[13px]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={optimizeImageUrl(cover, "card") ?? cover} alt="" className={"size-full object-cover " + (past ? "grayscale" : "")} />
        ) : (
          <div className="size-full" style={{ background: tickets[0] ? fallbackGradient(tickets[0]) : "rgba(124,58,237,0.3)" }} />
        )}
        {today && <span className="absolute bottom-1 left-1 size-2 rounded-full bg-cart-accent ring-2 ring-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold tracking-[-0.01em] text-cart-ink">{event.title}</p>
        <p className="mt-0.5 truncate text-[12px] font-semibold text-cart-ink-3">{formatDate(event.startsAt, event.timezone)}</p>
        <p className="mt-0.5 truncate text-[11px] font-bold text-cart-accent">{holdingLabel(tickets)}</p>
      </div>
      <span className="shrink-0 pr-1 text-[20px] text-cart-ink-4">›</span>
    </motion.button>
  );
}

// ── Avatar cuadrado de una entrada ───────────────────────────────────────────
function EntryAvatar({ label, color, kind }: { label: string; color: string; kind: "you" | "person" | "empty" }) {
  if (kind === "empty") {
    return (
      <span className="grid size-[38px] shrink-0 place-items-center rounded-[11px] border-2 border-dashed border-cart-line-strong text-[16px] font-medium text-cart-ink-4">
        +
      </span>
    );
  }
  return (
    <span
      className="grid size-[38px] shrink-0 place-items-center rounded-[11px] text-[14px] font-extrabold text-white"
      style={{ background: color }}
    >
      {label}
    </span>
  );
}

// ── Nivel 2: una fila de entrada individual ──────────────────────────────────
type EntradaState = "you" | "held" | "sent" | "review" | "unassigned" | "used" | "ended";

function EntradaRow({
  ticket,
  isYou,
  past,
  onSelect,
  onAssign,
}: {
  ticket: WalletTicket;
  isYou: boolean;
  past: boolean;
  onSelect: (t: WalletTicket) => void;
  onAssign: (t: WalletTicket) => void;
}) {
  const inReview = ticket.orderStatus === "pending";
  const state: EntradaState = past
    ? ticket.status === "used"
      ? "used"
      : "ended"
    : inReview
      ? "review"
      : ticket.pendingTransferTo
        ? "sent"
        : isYou
          ? "you"
          : ticket.holderName
            ? "held"
            : "unassigned";

  const name = isYou ? "Tú" : ticket.holderName ?? "Sin asignar";
  const avatarLabel = isYou ? "Tú" : (ticket.holderName?.trim()?.[0] ?? "?").toUpperCase();
  const sub: Record<EntradaState, string> = {
    you: "1 persona · tu QR listo",
    held: "1 persona · la muestras tú",
    sent: "Va por su lado · enviada a su cel",
    review: "Pago en revisión",
    unassigned: "¿De quién es esta?",
    used: "Ya ingresó",
    ended: "Evento finalizado",
  };

  const pill = (() => {
    switch (state) {
      case "you":
        return <span className="rounded-full bg-cart-accent-soft px-2.5 py-1 text-[10.5px] font-extrabold text-cart-accent">Tu QR</span>;
      case "held":
        return <span className="rounded-full bg-cart-bg-elev-2 px-2.5 py-1 text-[10.5px] font-extrabold text-cart-ink-3">En tu cel</span>;
      case "sent":
        return <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10.5px] font-extrabold text-emerald-600">Enviada</span>;
      case "review":
        return <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[10.5px] font-extrabold text-amber-600">En revisión</span>;
      default:
        return null;
    }
  })();

  return (
    <div className={"flex items-center gap-3 border-t border-cart-line-2 px-3.5 py-3.5 first:border-t-0 " + (isYou ? "bg-cart-accent-soft" : "")}>
      <button
        type="button"
        onClick={() => onSelect(ticket)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <EntryAvatar
          label={avatarLabel}
          color={isYou ? "var(--color-cart-accent)" : avatarColorForName(name)}
          kind={state === "unassigned" ? "empty" : "person"}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-[-0.01em] text-cart-ink">{name}</p>
          <p className="mt-0.5 truncate text-[11.5px] font-semibold text-cart-ink-3">{sub[state]}</p>
        </div>
      </button>
      {state === "unassigned" ? (
        <button
          type="button"
          onClick={() => onAssign(ticket)}
          className="shrink-0 rounded-full bg-cart-accent px-4 py-2 text-[12.5px] font-bold text-white transition active:scale-95"
        >
          Asignar
        </button>
      ) : state === "held" ? (
        // Palabra plana: abre el drawer para elegir (enviar / poner los datos).
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAssign(ticket)}
            className="rounded-full border border-cart-accent/40 px-3.5 py-1.5 text-[12px] font-bold text-cart-accent transition hover:bg-cart-accent-soft active:scale-95"
          >
            Asignar
          </button>
          <button type="button" onClick={() => onSelect(ticket)} aria-label="Ver QR" className="text-[19px] text-cart-ink-4">
            ›
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => onSelect(ticket)} className="flex shrink-0 items-center gap-1.5">
          {pill}
          <span className="text-[19px] text-cart-ink-4">›</span>
        </button>
      )}
    </div>
  );
}

// ── Nivel 2: card-resumen del box (se administra al abrirlo) ─────────────────
function BoxSummaryCard({ boxTicket, onOpen }: { boxTicket: WalletTicket; onOpen: (t: WalletTicket) => void }) {
  const boxQuery = useBoxForTicket(boxTicket.id);
  const box = boxQuery.data ?? null;

  const filled = box ? box.members.length : null;
  const capacity = box ? box.capacity : null;
  const remaining = box ? Math.max(0, box.capacity - box.members.length) : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(boxTicket)}
      className="mb-2.5 flex w-full flex-col gap-3.5 rounded-[18px] border border-cart-line bg-white p-4 text-left shadow-[0_1px_2px_rgba(20,10,60,0.04)] transition hover:border-cart-accent/40 active:scale-[0.995]"
    >
      {/* Fila 1: Box A + para cuántos */}
      <div className="flex items-center gap-3">
        <span className="inline-flex shrink-0 items-baseline gap-1.5 rounded-[12px] bg-cart-accent px-2.5 py-1.5 text-white">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] opacity-85">Box</span>
          <span className="text-[18px] font-black leading-none tracking-[-0.02em]">{boxTicket.boxLabel?.replace(/^box\s*/i, "")}</span>
        </span>
        <span className="min-w-0 flex-1 text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-cart-ink">
          {capacity ? `Para ${capacity} personas` : "Tu box"}
        </span>
        <span className="shrink-0 text-[19px] text-cart-ink-4">›</span>
      </div>

      {/* Fila 2: avatares + progreso */}
      <div className="flex items-center gap-3">
        {box ? (
          <span className="inline-flex shrink-0">
            {box.members.slice(0, 3).map((m, i) => (
              <span
                key={m.profileId}
                className="grid size-[26px] place-items-center rounded-[8px] text-[9px] font-extrabold text-white ring-2 ring-white"
                style={{ background: avatarColorForName(m.name ?? ""), marginLeft: i === 0 ? 0 : -7 }}
              >
                {(m.name?.trim()?.[0] ?? "?").toUpperCase()}
              </span>
            ))}
            {remaining! > 0 && (
              <span
                className="grid size-[26px] place-items-center rounded-[8px] border-2 border-dashed border-cart-line-strong bg-cart-bg-elev-2 text-[8.5px] font-extrabold text-cart-ink-4"
                style={{ marginLeft: -7 }}
              >
                +{remaining}
              </span>
            )}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-cart-accent">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="8" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="16" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 18c0-2.5 2.2-4 5-4s5 1.5 5 4M13 17.5c.3-2.2 2.2-3.5 4.5-3.5s3.5 1.2 4.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
        )}
        <span className="min-w-0 flex-1 text-[12px] font-semibold text-cart-ink-3">
          {box && filled != null && capacity != null ? (
            remaining && remaining > 0 ? (
              <>
                <b className="text-cart-accent">{filled} de {capacity}</b> · faltan {remaining} por invitar
              </>
            ) : (
              <>
                <b className="text-cart-accent">{filled} de {capacity}</b> · box completo
              </>
            )
          ) : (
            "Toca para invitar y ver los QR"
          )}
        </span>
      </div>
    </button>
  );
}

// ── Nivel 2: pantalla de entradas de un evento ───────────────────────────────
function TicketSelectScreen({
  group,
  past,
  youId,
  onBack,
  onSelect,
  onAssign,
}: {
  group: EventGroup;
  past: boolean;
  youId: string | null;
  onBack: () => void;
  onSelect: (ticket: WalletTicket) => void;
  onAssign: (ticket: WalletTicket) => void;
}) {
  const { event, tickets } = group;
  const cover = event.coverUrl;
  const today = isToday(event.startsAt, event.timezone);
  // El box es otra categoría: va en su propia sección, no mezclado con las
  // entradas individuales. listMine entrega un box por entrada (el host); sus
  // acompañantes se administran al abrir el box, no acá.
  const boxTickets = tickets.filter((t) => t.boxLabel);
  const singles = tickets.filter((t) => !t.boxLabel);
  const hasBox = boxTickets.length > 0;

  return (
    <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.18 }}>
      {/* Back */}
      <button type="button" onClick={onBack} className="flex items-center gap-2 py-2.5 text-[14px] font-bold text-cart-ink-3 transition hover:text-cart-ink">
        <span className="text-[16px]">←</span> Mis entradas
      </button>

      {/* Cabecera compacta del evento */}
      <div className="mb-1 flex items-center gap-3 border-b border-cart-line pb-4">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={optimizeImageUrl(cover, "card") ?? cover} alt="" className={"size-[54px] shrink-0 rounded-[14px] object-cover shadow-[0_4px_12px_-3px_rgba(40,20,90,0.3)] " + (past ? "grayscale" : "")} />
        ) : (
          <div
            className="grid size-[54px] shrink-0 place-items-center rounded-[14px] text-[20px] font-black text-white"
            style={{ background: tickets[0] ? fallbackGradient(tickets[0]) : "rgba(124,58,237,0.3)" }}
          >
            {event.title.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-cart-ink-4">Estás dentro de</p>
          <h1 className="truncate text-[18px] font-extrabold tracking-[-0.02em] text-cart-ink">{event.title}</h1>
          <p className="truncate text-[11.5px] font-semibold text-cart-ink-3">
            {compactWhen(event.startsAt, event.timezone)}
            {event.venue ? ` · ${event.venue}` : ""}
          </p>
        </div>
        {today && !past && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-cart-accent px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" /> Hoy
          </span>
        )}
      </div>

      {/* Sección BOXES */}
      {hasBox && (
        <>
          <SectionTitle>Boxes</SectionTitle>
          <SectionSub>Tu espacio · ábrelo para invitar y ver los QR</SectionSub>
          {boxTickets.map((t) => (
            <BoxSummaryCard key={t.id} boxTicket={t} onOpen={onSelect} />
          ))}
        </>
      )}

      {/* Sección ENTRADAS */}
      {singles.length > 0 && (
        <>
          <SectionTitle>{hasBox ? "Entradas" : "Tus entradas"}</SectionTitle>
          <SectionSub>
            {hasBox
              ? `${singles.length} ${singles.length === 1 ? "suelta" : "sueltas"} · para los que no van en el box`
              : "Toca una para ver su QR · así repartes a tu gente"}
          </SectionSub>
          <div className="overflow-hidden rounded-[18px] border border-cart-line bg-white">
            {singles.map((t) => (
              <EntradaRow
                key={t.id}
                ticket={t}
                isYou={t.id === youId}
                past={past}
                onSelect={onSelect}
                onAssign={onAssign}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

// ── Sheet "¿para quién es?" — mismo primitivo Sheet del login ────────────────
function AssignChooserSheet({
  open,
  onClose,
  onSend,
  onSetData,
}: {
  open: boolean;
  onClose: () => void;
  onSend: () => void;
  onSetData: () => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="¿Para quién es este acceso?"
      description="Elige cómo lo repartes: enviársela a alguien o poner sus datos."
    >
      <p className="mb-1 text-[22px] font-bold leading-tight tracking-[-0.03em] text-cart-ink">Este acceso · ¿para quién es?</p>
      <p className="mb-5 text-[13px] leading-[1.5] text-cart-ink-3">Elige cómo lo repartes. Lo puedes cambiar después.</p>
      <button
        type="button"
        onClick={onSend}
        className="flex w-full items-center gap-3 rounded-[17px] border border-cart-line bg-cart-bg px-3.5 py-3.5 text-left transition hover:border-cart-accent/40 active:scale-[0.99]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-cart-accent-soft text-cart-accent"><Send size={19} strokeWidth={2} /></span>
        <span className="min-w-0">
          <span className="block text-[14.5px] font-extrabold tracking-[-0.01em] text-cart-ink">Enviársela a alguien</span>
          <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-cart-ink-3">Le llega por WhatsApp y la abre en su celular · queda a su nombre</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onSetData}
        className="mt-2.5 flex w-full items-center gap-3 rounded-[17px] border border-cart-line bg-cart-bg px-3.5 py-3.5 text-left transition hover:border-cart-accent/40 active:scale-[0.99]"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-cart-accent-soft text-cart-accent"><Pencil size={19} strokeWidth={2} /></span>
        <span className="min-w-0">
          <span className="block text-[14.5px] font-extrabold tracking-[-0.01em] text-cart-ink">Solo poner sus datos</span>
          <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-cart-ink-3">La guardas tú · nombre y DNI para el control en la puerta</span>
        </span>
      </button>
      <button type="button" onClick={onClose} className="mt-2 w-full py-3 text-center text-[14px] font-bold text-cart-ink-3">
        Ahora no
      </button>
    </Sheet>
  );
}

// ── Skeleton de carga ──────────────────────────────────────────────────────
function WalletSkeleton() {
  return (
    <div className="cart-grain relative min-h-screen bg-cart-bg font-sans text-cart-ink">
      <div className="relative z-[1] mx-auto w-full max-w-[640px] px-4 pb-[96px] pt-[max(16px,env(safe-area-inset-top))] sm:px-6">
        <div className="py-3">
          <div className="h-3 w-20 animate-pulse rounded bg-cart-bg-elev-2" />
          <div className="mt-2 h-7 w-32 animate-pulse rounded bg-cart-bg-elev-2" />
        </div>
        <div className="mt-2 h-10 animate-pulse rounded-2xl bg-cart-bg-elev" />
        <div className="flex flex-col gap-3 pt-5">
          <TicketHeroCardSkeleton />
          {[0, 1].map((i) => (
            <div key={i} className="h-[80px] animate-pulse rounded-[18px] bg-cart-bg-elev" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
// La wallet vive 100% del cache cliente (React Query persistido en localStorage):
// renderizarla en el server produce un árbol distinto al primer paint del cliente
// → hydration mismatch. La cargamos CLIENT-ONLY (ssr:false, que usa Suspense por
// debajo) con un skeleton mientras hidrata. Esto además cubre useSearchParams().
const WalletClient = dynamic(() => Promise.resolve(WalletPageInner), {
  ssr: false,
  loading: () => <WalletSkeleton />,
});

export default function WalletPage() {
  return (
    <Suspense fallback={<WalletSkeleton />}>
      <WalletClient />
    </Suspense>
  );
}

function WalletPageInner() {
  const tickets = useMyTickets();
  const { sessionReady, loggedIn } = useSessionReady();
  const me = useCurrentUser();
  usePrefetchWallet(tickets.data);
  const online = useOnline();
  const router = useRouter();

  // Apaga el dot de "Mis entradas" en el nav al entrar acá — una sola vez por
  // sesión de la página, y solo con red (offline no confirmamos nada al
  // server). El POST reintenta solo (retry:2, ver useMarkTicketNotificationsRead)
  // para absorber fallas transitorias (ej. cold-start 502 de deploy); si aun así
  // falla, se loguea en vez de fallar en silencio — no reintentamos desde acá
  // para no convertir una falla persistente en un loop de requests.
  const markTicketsRead = useMarkTicketNotificationsRead();
  const markedRead = useRef(false);
  useEffect(() => {
    if (markedRead.current || !sessionReady || !loggedIn || !online) return;
    markedRead.current = true;
    markTicketsRead.mutate(undefined, {
      onError: (error) => {
        console.error("[tickets] no se pudo marcar notificaciones como leídas", error);
      },
    });
  }, [sessionReady, loggedIn, online, markTicketsRead]);
  const [tab, setTab] = useState<"next" | "past">("next");

  // "list" → lista de eventos · "select" → entradas de un evento
  const [view, setView] = useState<"list" | "select">("list");
  // Guardamos el ID del evento activo, NO el grupo: el reparto es inline (queda
  // en la vista "select") y al asignar/enviar la wallet se refetchea; derivar el
  // grupo de los datos vivos hace que las filas reflejen el cambio (un snapshot
  // del grupo quedaría congelado y la fila seguiría diciendo "Sin asignar").
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  // Reparto inline (rápido, sin salir de la lista):
  // - chooserTicket → sheet "¿para quién es?" (entrada sin asignar)
  // - sendTicket    → sheet Enviar (transferir por WhatsApp)
  // - editTicket    → sheet Cambiar datos (nombre/DNI del titular)
  const [chooserTicket, setChooserTicket] = useState<WalletTicket | null>(null);
  const [sendTicket, setSendTicket] = useState<WalletTicket | null>(null);
  const [editTicket, setEditTicket] = useState<WalletTicket | null>(null);

  const all = useMemo(() => tickets.data ?? [], [tickets.data]);

  // Nombre del usuario para marcar su acceso "Tú" en la lista (presentación).
  const myName = me.data?.user?.fullName?.trim().toLowerCase() ?? null;

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

  // Grupo activo DERIVADO de los datos vivos (no un snapshot) — se re-sincroniza
  // solo cuando la wallet refetchea tras un reparto inline.
  const activeGroup = useMemo(
    () =>
      activeEventId == null
        ? null
        : upcomingGroups.find((g) => g.event.id === activeEventId) ??
          pastGroups.find((g) => g.event.id === activeEventId) ??
          null,
    [activeEventId, upcomingGroups, pastGroups],
  );

  // Higiene de estado: si el evento activo desaparece de la wallet mientras
  // estás en "select" (caso raro: el receptor reclama y el grupo se vacía),
  // volvemos a la lista para no dejar `view`/`activeEventId` apuntando a la nada.
  useEffect(() => {
    if (view === "select" && !activeGroup) {
      setView("list");
      setActiveEventId(null);
    }
  }, [view, activeGroup]);

  // Deep-link "Ver todas" desde el QR: /tickets?event=<id> abre directo la lista
  // de entradas de ese evento (vista "select").
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
    setActiveEventId(eventParam);
    setView("select");
  }, [eventParam, all.length, upcoming, past]);

  const currentGroups = tab === "next" ? upcomingGroups : pastGroups;

  // Agrupar por mes (solo para la pestaña "Pasadas", que es una lista larga)
  const groupedByMonth = useMemo(() => {
    const months = new Map<string, EventGroup[]>();
    for (const g of currentGroups) {
      const label = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: g.event.timezone }).format(new Date(g.event.startsAt));
      const key = label.charAt(0).toUpperCase() + label.slice(1);
      if (!months.has(key)) months.set(key, []);
      months.get(key)!.push(g);
    }
    return [...months.entries()];
  }, [currentGroups]);

  // Nivel 1 "Próximas": hero del más cercano + el resto como filas compactas.
  const heroGroup = tab === "next" && upcomingGroups.length > 0 ? upcomingGroups[0] : null;
  const restUpcoming = tab === "next" ? upcomingGroups.slice(1) : [];

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
    // Una sola entrada → directo al QR.
    if (group.tickets.length === 1) {
      router.push(`/tickets/${group.tickets[0].id}` as never);
      return;
    }
    setActiveEventId(group.event.id);
    setView("select");
    syncEventParam(group.event.id);
  };

  const handleBack = () => {
    setView("list");
    setActiveEventId(null);
    syncEventParam(null);
  };

  const handleSelectTicket = (ticket: WalletTicket) => {
    router.push(`/tickets/${ticket.id}` as never);
  };

  // "Tú" = la entrada suelta del grupo activo cuyo titular coincide con tu nombre.
  const youId = useMemo(() => {
    if (!activeGroup || !myName) return null;
    const mine = activeGroup.tickets.find(
      (t) => !t.boxLabel && (t.holderName?.trim().toLowerCase() ?? "") === myName,
    );
    return mine?.id ?? null;
  }, [activeGroup, myName]);

  if (!sessionReady) {
    return <WalletSkeleton />;
  }

  if (!loggedIn) {
    return (
      <LoginGate
        title="Inicia sesión para ver tus entradas"
        subtitle="Tus entradas y QR viven en tu cuenta. Inicia sesión para verlas y mostrarlas en la puerta."
        next="/tickets"
      />
    );
  }

  return (
    <div className="cart-grain relative min-h-screen bg-cart-bg font-sans text-cart-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[600px] w-[900px] -translate-x-1/2 blur-[90px]"
        style={{ background: "radial-gradient(closest-side, rgba(124,58,237,0.12), transparent 70%)" }}
      />

      <div className="relative z-[1] mx-auto w-full max-w-[640px] px-4 pb-[96px] pt-[max(16px,env(safe-area-inset-top))] sm:px-6">
        {!online && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-400/[0.12] px-3 py-2 text-[12px] text-amber-700">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Sin conexión · mostramos tus entradas guardadas. Tu QR funciona igual.
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === "list" || !activeGroup ? (
            <motion.div key="list" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
              {/* Header */}
              <header className="py-3">
                <p className="text-[12px] font-medium text-cart-ink-3">Mis entradas</p>
                <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-cart-ink">
                  {currentGroups.length === 0 ? "Sin eventos" : `${currentGroups.length} evento${currentGroups.length === 1 ? "" : "s"}`}
                </h1>
              </header>

              {/* Tabs */}
              <div className="mt-1 flex gap-1 rounded-2xl bg-cart-bg-elev p-1 shadow-[0_0_0_1px_var(--color-cart-line)_inset] lg:mt-2 lg:gap-7 lg:rounded-none lg:border-b lg:border-cart-line lg:bg-transparent lg:p-0 lg:shadow-none">
                <TabBtn label="Próximas" count={upcomingGroups.length} on={tab === "next"} onClick={() => setTab("next")} />
                <TabBtn label="Pasadas" count={pastGroups.length} on={tab === "past"} onClick={() => setTab("past")} />
              </div>

              {/* Skeletons */}
              {tickets.isLoading && (
                <div className="flex flex-col gap-3 pt-5">
                  <TicketHeroCardSkeleton />
                  {[0, 1].map((i) => (
                    <div key={i} className="h-[80px] animate-pulse rounded-[18px] bg-cart-bg-elev" />
                  ))}
                </div>
              )}

              {/* Vacío */}
              {!tickets.isLoading && all.length === 0 && <EmptyState />}

              {/* Próximas: hero + resto compacto */}
              {!tickets.isLoading && tab === "next" && heroGroup && (
                <div className="pt-5">
                  <TicketHeroCard group={heroGroup} onOpen={() => handleSelectEvent(heroGroup)} />
                  {restUpcoming.length > 0 && (
                    <>
                      <p className="mb-3 mt-6 px-0.5 text-[12px] font-bold text-cart-ink-3">Tus otros eventos</p>
                      {restUpcoming.map((g) => (
                        <EventMiniRow key={g.event.id} group={g} past={false} onClick={() => handleSelectEvent(g)} />
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Pasadas: lista compacta agrupada por mes */}
              {!tickets.isLoading && tab === "past" && pastGroups.length > 0 && (
                <div className="pt-5">
                  {groupedByMonth.map(([month, groups]) => (
                    <div key={month} className="mb-6">
                      <p className="mb-2.5 px-0.5 text-[12px] font-semibold tracking-wide text-cart-ink-3">{month}</p>
                      {groups.map((g) => (
                        <EventMiniRow key={g.event.id} group={g} past onClick={() => handleSelectEvent(g)} />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {!tickets.isLoading && tab === "past" && pastGroups.length === 0 && (
                <p className="py-12 text-center text-[13.5px] text-cart-ink-3">Aún no hay entradas pasadas.</p>
              )}
            </motion.div>
          ) : (
            activeGroup && (
              <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="pt-[max(16px,env(safe-area-inset-top))]">
                <TicketSelectScreen
                  group={activeGroup}
                  past={tab === "past"}
                  youId={youId}
                  onBack={handleBack}
                  onSelect={handleSelectTicket}
                  onAssign={setChooserTicket}
                />
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* Reparto: sheet "¿para quién es?" (entrada sin asignar) → Enviar / Cambiar datos */}
      <AssignChooserSheet
        open={!!chooserTicket}
        onClose={() => setChooserTicket(null)}
        onSend={() => {
          const t = chooserTicket;
          setChooserTicket(null);
          if (t) setSendTicket(t);
        }}
        onSetData={() => {
          const t = chooserTicket;
          setChooserTicket(null);
          if (t) setEditTicket(t);
        }}
      />

      {/* Enviar entrada — inline, sin salir de la lista (rápido y de primera mano) */}
      <TransferTicketSheet
        open={!!sendTicket}
        ticketId={sendTicket?.id ?? ""}
        online={online}
        onClose={() => setSendTicket(null)}
      />

      {/* Cambiar datos del titular — inline */}
      <HolderEditSheet
        open={!!editTicket}
        ticketId={editTicket?.id ?? ""}
        currentName={editTicket?.holderName ?? null}
        currentDniLast2={editTicket?.holderDniLast2 ?? null}
        ticketTypeName={editTicket?.ticketType.name ?? ""}
        online={online}
        variant="gift"
        onClose={() => setEditTicket(null)}
      />
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
          ? "bg-cart-accent text-white shadow-[0_8px_24px_-12px_var(--color-cart-accent-glow)] lg:bg-transparent lg:text-cart-ink lg:shadow-none lg:border-cart-accent"
          : "text-cart-ink-3 hover:text-cart-ink lg:border-transparent")
      }
    >
      {label}
      <span
        className={
          "rounded-full px-1.5 py-px text-[10.5px] font-bold " +
          (on ? "bg-white/25 lg:bg-cart-accent/15 lg:text-cart-accent" : "bg-cart-bg-elev-2 text-cart-ink-3")
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
      <div className="mb-5 grid size-20 place-items-center rounded-3xl" style={{ background: "linear-gradient(150deg, rgba(124,58,237,0.35), rgba(124,58,237,0.08))" }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="text-cart-accent">
          <path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 7v10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
        </svg>
      </div>
      <h2 className="text-[19px] font-bold tracking-[-0.01em] text-cart-ink">Aún no tienes entradas</h2>
      <p className="mt-1.5 max-w-[260px] text-[13.5px] text-cart-ink-3">Cuando compres una, aparecerá aquí lista para mostrar en la puerta.</p>
      <Link href={"/recover-tickets" as never} className="mt-4 text-[13px] font-medium text-cart-ink-2 underline-offset-2 hover:text-cart-ink hover:underline">
        ¿Compraste y no ves tu QR? Recuperar
      </Link>
      <Link
        href={"/" as never}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-cart-accent px-6 py-3 text-[14.5px] font-semibold text-white shadow-[0_10px_30px_-10px_var(--color-cart-accent-glow-strong)] transition active:scale-95"
      >
        Explorar eventos
      </Link>
    </div>
  );
}

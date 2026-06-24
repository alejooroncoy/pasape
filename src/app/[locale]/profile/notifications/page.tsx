"use client";

import { useNotifications } from "@/lib/identity/hooks/useNotifications";
import type { Notification } from "@/server/identity/application/ListNotifications";
import { PageShell, BackLink, PageTitle } from "../_components/PageShell";

const labelFor = (kind: string): string => {
  const map: Record<string, string> = {
    ticket_ready: "Tu entrada está lista",
    purchase_confirmed: "Compra confirmada",
    qr_ready: "Tu QR está listo",
    event_reminder: "Recordatorio de evento",
    transfer_received: "Entrada transferida",
    promoter_claimed: "Nuevo promotor",
    new_event: "Nuevo evento",
    promo: "Promoción",
    event_updated: "Cambios en tu evento",
  };
  return map[kind] ?? "Novedad";
};

const FIELD_LABELS: Record<string, string> = {
  startsAt: "fecha",
  venue: "lugar",
  title: "nombre",
  status: "estado",
};

const formatEventUpdated = (n: Notification): string => {
  const p = n.payload;
  const title = typeof p.eventTitle === "string" ? p.eventTitle : "tu evento";
  const changesRaw = Array.isArray(p.changes) ? (p.changes as unknown[]) : [];
  const changes = changesRaw.filter((c): c is string => typeof c === "string");
  // Why: prioritize status change copy (cancelled / closed) since it's the
  // most consequential message for the buyer.
  if (changes.includes("status") && typeof p.newStatus === "string") {
    if (p.newStatus === "cancelled") return `El evento ${title} fue cancelado.`;
    if (p.newStatus === "closed") return `El evento ${title} se cerró.`;
  }
  const parts: string[] = [];
  if (changes.includes("startsAt") && typeof p.newStartsAt === "string") {
    const d = new Date(p.newStartsAt);
    if (!Number.isNaN(d.getTime())) {
      parts.push(`nueva fecha ${d.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })}`);
    } else {
      parts.push("nueva fecha");
    }
  }
  if (changes.includes("venue")) {
    parts.push(typeof p.newVenue === "string" && p.newVenue ? `nuevo lugar ${p.newVenue}` : "nuevo lugar");
  }
  if (changes.includes("title")) parts.push("nuevo nombre");
  if (parts.length === 0) {
    const labels = changes.map((c) => FIELD_LABELS[c] ?? c).join(", ");
    return `El evento ${title} cambió${labels ? `: ${labels}` : ""}.`;
  }
  return `El evento ${title} cambió: ${parts.join(", ")}.`;
};

const summaryFor = (n: Notification): string => {
  const p = n.payload;
  if (n.kind === "event_updated") return formatEventUpdated(n);

  if (n.kind === "ticket_ready") {
    const title = typeof p.eventTitle === "string" ? p.eventTitle : "tu evento";
    const count = typeof p.ticketsCount === "number" ? p.ticketsCount : 1;
    return count > 1
      ? `Tus ${count} entradas para ${title} ya están listas. Tócalas para ver el QR.`
      : `Tu entrada para ${title} ya está lista. Tócala para ver el QR.`;
  }

  if (n.kind === "promoter_claimed") {
    const who =
      typeof p.claimedByName === "string" && p.claimedByName ? p.claimedByName : "Alguien";
    return `${who} se registró como promotor.`;
  }

  if (typeof p.message === "string") return p.message;
  if (typeof p.title === "string") return p.title;
  if (typeof p.event_title === "string") return String(p.event_title);
  return "Toca para ver el detalle.";
};

const formatGroup = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "HOY";
  if (diff === 1) return "AYER";
  if (diff < 7) return "ESTA SEMANA";
  if (diff < 30) return "ESTE MES";
  return "ANTERIOR";
};

const groupByDate = (notifs: Notification[]) => {
  const groups = new Map<string, Notification[]>();
  for (const n of notifs) {
    const key = formatGroup(n.createdAt);
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }
  return Array.from(groups.entries());
};

// Ícono según el tipo de notificación.
function NotifIcon({ kind }: { kind: string }) {
  const sw = { stroke: "currentColor", strokeWidth: 1.4, fill: "none" as const };
  if (kind === "ticket_ready" || kind === "qr_ready" || kind === "transfer_received") {
    return (
      <svg width="16" height="16" viewBox="0 0 18 18">
        <path d="M2 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1 1.5 1.5 0 0 0 0 3 1 1 0 0 1-1 1H3a1 1 0 0 1-1-1 1.5 1.5 0 0 0 0-3Z" {...sw} strokeLinejoin="round" />
        <path d="M11 5v6" {...sw} strokeDasharray="1.5 1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "event_updated" || kind === "event_reminder" || kind === "new_event") {
    return (
      <svg width="16" height="16" viewBox="0 0 18 18">
        <rect x="3" y="4" width="12" height="11" rx="1.6" {...sw} />
        <path d="M3 7.5h12M6 2.5v3M12 2.5v3" {...sw} strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "promoter_claimed") {
    return (
      <svg width="16" height="16" viewBox="0 0 18 18">
        <circle cx="9" cy="6" r="2.6" {...sw} />
        <path d="M3.5 15c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" {...sw} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 18 18">
      <path d="M4 12V8a5 5 0 0 1 10 0v4l1.5 2h-13L4 12Z" {...sw} strokeLinejoin="round" />
      <path d="M7 15a2 2 0 0 0 4 0" {...sw} strokeLinecap="round" />
    </svg>
  );
}

const NotifCard = ({ n }: { n: Notification }) => {
  const isUnread = !n.readAt;
  return (
    <div
      className={
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5 transition " +
        (isUnread ? "border-cart-accent/30 bg-cart-accent/10" : "border-cart-line bg-cart-bg-elev")
      }
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cart-accent/15 text-cart-accent">
        <NotifIcon kind={n.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[14px] font-semibold">
          {labelFor(n.kind)}
          {isUnread && (
            <span className="size-1.5 rounded-full bg-cart-accent shadow-[0_0_8px_var(--color-cart-accent)]" />
          )}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-white/55">{summaryFor(n)}</p>
      </div>
    </div>
  );
};

export default function BuyerNotificationsPage() {
  const { data, isLoading, error } = useNotifications();
  const items = data ?? [];
  const groups = groupByDate(items);

  return (
    <PageShell>
      <BackLink />
      <PageTitle title="Tu actividad" subtitle="Solo lo que importa de tu noche." />

      {isLoading && (
        <div className="flex flex-col gap-2.5 pt-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      )}
      {error && <p className="pt-6 text-[13px] text-red-300">{(error as Error).message}</p>}

      {!isLoading && !error && items.length === 0 && (
        <div className="mt-6 rounded-2xl border border-cart-line bg-cart-bg-elev p-6 text-center text-[13.5px] text-white/55">
          Sin novedades por ahora.
        </div>
      )}

      {groups.map(([label, list]) => (
        <div key={label} className="pt-5">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
          <div className="flex flex-col gap-2.5">
            {list.map((n) => (
              <NotifCard key={n.id} n={n} />
            ))}
          </div>
        </div>
      ))}
    </PageShell>
  );
}

"use client";

import { BackBtn, C, FONT_DISPLAY, Phone } from "@/components/design";
import { useNotifications } from "@/lib/identity/hooks/useNotifications";
import type { Notification } from "@/server/identity/application/ListNotifications";

const labelFor = (kind: string): string => {
  const map: Record<string, string> = {
    purchase_confirmed: "Compra confirmada",
    qr_ready: "Tu QR está listo",
    event_reminder: "Recordatorio de evento",
    transfer_received: "Entrada transferida",
    new_event: "Nuevo evento",
    promo: "Promoción",
    event_updated: "Cambios en tu evento",
  };
  return map[kind] ?? kind.replace(/_/g, " ");
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
  if (n.kind === "event_updated") return formatEventUpdated(n);
  const p = n.payload;
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

const NotifCard = ({ n }: { n: Notification }) => {
  const isUnread = !n.readAt;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 16px",
        marginBottom: 8,
        background: isUnread ? C.purpleSoft : "rgba(255,255,255,0.03)",
        boxShadow: `0 0 0 1px ${isUnread ? C.purpleEdge : C.line} inset`,
        borderRadius: 14,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          background: "rgba(124,58,237,0.18)",
          color: C.purple,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
          <path
            d="M4 12V8a5 5 0 0 1 10 0v4l1.5 2h-13L4 12Z"
            stroke={C.purple}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M7 15a2 2 0 0 0 4 0" stroke={C.purple} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {labelFor(n.kind)}
          {isUnread && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: C.purple,
                boxShadow: `0 0 8px ${C.purple}`,
              }}
            />
          )}
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{summaryFor(n)}</div>
      </div>
    </div>
  );
};

export default function BuyerNotificationsPage() {
  const { data, isLoading, error } = useNotifications();
  const items = data ?? [];
  const groups = groupByDate(items);

  return (
    <Phone>
      <div
        style={{
          padding: "6px 22px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>NOTIFICACIONES</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ padding: "14px 22px" }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          Tu actividad.
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.4 }}>
          Solo lo que importa de tu noche.
        </div>

        {isLoading && <div style={{ marginTop: 22, color: C.dim }}>Cargando…</div>}
        {error && <div style={{ marginTop: 22, color: C.red }}>{(error as Error).message}</div>}

        {!isLoading && !error && items.length === 0 && (
          <div
            style={{
              marginTop: 22,
              padding: 22,
              borderRadius: 14,
              boxShadow: `0 0 0 1px ${C.line} inset`,
              background: "rgba(255,255,255,0.02)",
              color: C.dim,
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Sin novedades por ahora.
          </div>
        )}

        {groups.map(([label, list]) => (
          <div key={label} style={{ marginTop: 18 }}>
            <div
              style={{
                fontSize: 11,
                color: C.dim,
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {label}
            </div>
            {list.map((n) => (
              <NotifCard key={n.id} n={n} />
            ))}
          </div>
        ))}
      </div>
    </Phone>
  );
}

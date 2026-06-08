"use client";

import { useMemo } from "react";
import { BackBtn, C, FONT_DISPLAY, Phone, ProfileMenu, TopBar } from "@/components/design";
import { Link, useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import type { WalletTicket } from "@/server/tickets/domain/Ticket";

const COLOR_PAIRS: Array<[string, string]> = [
  ["#22D17F", "#7C3AED"],
  ["#FF4D5E", "#FFCE3B"],
  ["#4B1F9A", "#FF4D5E"],
  ["#7C3AED", "#22D17F"],
];

const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" })
    .format(d)
    .toUpperCase();
};

const whenLabel = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("es-PE", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date(iso))
    .replace(/\./g, "")
    .replace(/^./, (c) => c.toUpperCase());

const TicketTab = ({ label, count, on }: { label: string; count: number; on?: boolean }) => (
  <div
    style={{
      flex: 1,
      padding: "10px 12px",
      borderRadius: 10,
      textAlign: "center",
      background: on ? "#fff" : "transparent",
      color: on ? "#0A0A0F" : C.dim,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    }}
  >
    <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
    <span
      style={{
        fontSize: 10,
        padding: "1px 6px",
        borderRadius: 999,
        background: on ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)",
        color: on ? "#0A0A0F" : C.dim,
        fontWeight: 700,
      }}
    >
      {count}
    </span>
  </div>
);

const StatMini = ({ n, k }: { n: string; k: string }) => (
  <div>
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        lineHeight: 1,
      }}
    >
      {n}
    </div>
    <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{k}</div>
  </div>
);

const PastRow = ({
  title,
  when,
  missed,
  color1,
  color2,
}: {
  title: string;
  when: string;
  missed?: boolean;
  color1: string;
  color2: string;
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 12px",
      marginBottom: 8,
      background: "rgba(255,255,255,0.02)",
      borderRadius: 14,
      boxShadow: `0 0 0 1px ${C.line} inset`,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        flexShrink: 0,
        background: `linear-gradient(135deg, ${color1}, ${color2})`,
        filter: "saturate(0.6) brightness(0.7)",
      }}
    />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 600,
          fontSize: 13,
          color: "rgba(255,255,255,0.85)",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{when}</div>
    </div>
    <div
      style={{
        fontSize: 10,
        padding: "4px 8px",
        borderRadius: 999,
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: missed ? C.redSoft : "rgba(255,255,255,0.05)",
        color: missed ? C.red : C.dim,
      }}
    >
      {missed ? "NO FUISTE" : "✓ INGRESASTE"}
    </div>
  </div>
);

export default function BuyerTicketsPastPage() {
  const me = useCurrentUser();
  const tickets = useMyTickets();
  const router = useRouter();

  const { past, upcomingCount, totalSpentCents, boxesCount, grouped } = useMemo(() => {
    const all = tickets.data ?? [];
    const past: WalletTicket[] = [];
    let upcoming = 0;
    for (const t of all) {
      const isPast = t.event.status === "closed" || t.event.status === "cancelled" || t.status === "used";
      if (isPast) past.push(t);
      else upcoming++;
    }
    past.sort(
      (a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime(),
    );
    const grouped = new Map<string, WalletTicket[]>();
    for (const t of past) {
      const key = monthLabel(t.event.startsAt);
      const arr = grouped.get(key) ?? [];
      arr.push(t);
      grouped.set(key, arr);
    }
    const boxesCount = past.filter((t) => t.ticketType.kind === "box").length;
    return {
      past,
      upcomingCount: upcoming,
      totalSpentCents: 0,
      boxesCount,
      grouped,
    };
  }, [tickets.data]);

  void totalSpentCents;

  return (
    <Phone>
      <div
        style={{
          padding: "6px 22px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <BackBtn />
        <ProfileMenu
          initials={me.data?.user?.fullName?.charAt(0).toUpperCase() ?? "·"}
          color={C.red}
        />
      </div>
      <TopBar hello="Mis entradas" title="Pasadas" />
      <div style={{ padding: "0 22px 32px" }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 16,
            padding: 4,
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            boxShadow: `0 0 0 1px ${C.line} inset`,
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                "/tickets" as any,
              )
            }
            style={{
              flex: 1,
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
              color: "inherit",
            }}
          >
            <TicketTab label="Próximas" count={upcomingCount} />
          </button>
          <TicketTab label="Pasadas" count={past.length} on />
        </div>

        <div
          style={{
            padding: "16px 18px",
            borderRadius: 18,
            marginBottom: 16,
            background: "linear-gradient(180deg, rgba(124,58,237,0.18), rgba(124,58,237,0.02))",
            boxShadow: `0 0 0 1px ${C.purpleEdge} inset`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              color: C.purple,
              fontWeight: 700,
            }}
          >
            ◆ TUS NOCHES
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
            <StatMini n={String(past.length)} k="eventos" />
            <StatMini n={String(boxesCount)} k="boxes" />
            <StatMini
              n={String(past.filter((t) => t.status === "used").length)}
              k="ingresaste"
            />
          </div>
        </div>

        {tickets.isLoading && (
          <div style={{ color: C.dim, fontSize: 13, padding: "20px 0" }}>Cargando…</div>
        )}

        {!tickets.isLoading && past.length === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center", color: C.dim, fontSize: 13 }}>
            Todavía no tienes entradas pasadas.
          </div>
        )}

        {Array.from(grouped.entries()).map(([month, items]) => (
          <div key={month}>
            <div
              style={{
                fontSize: 11,
                color: C.dim,
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginTop: 14,
                marginBottom: 10,
              }}
            >
              {month}
            </div>
            {items.map((t, idx) => {
              const [c1, c2] = COLOR_PAIRS[idx % COLOR_PAIRS.length]!;
              return (
                <Link
                  key={t.id}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={`/tickets/${t.id}` as any}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <PastRow
                    title={t.event.title}
                    when={whenLabel(t.event.startsAt, t.event.timezone)}
                    missed={t.status !== "used"}
                    color1={c1}
                    color2={c2}
                  />
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </Phone>
  );
}

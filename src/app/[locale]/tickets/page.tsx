"use client";

import { useMemo, useState } from "react";
import {
  Btn,
  C,
  FannedTicketsHero,
  Phone,
  ProfileMenu,
  TicketCardLg,
  TicketCardSm,
  TicketTab,
  TopBar,
} from "@/components/design";
import { Link, useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMyTickets } from "@/lib/tickets/hooks/useTickets";
import { formatDate } from "@/lib/_shared/format";

const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#7C3AED", "#FF4D5E"],
  ["#FF4D5E", "#FFCE3B"],
  ["#22D17F", "#7C3AED"],
  ["#7C3AED", "#22D17F"],
];

const formatCountdown = (iso: string, now: number): string => {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "ahora";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const isToday = (iso: string, now: number): boolean => {
  const d = new Date(iso);
  const today = new Date(now);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

export default function WalletPage() {
  const me = useCurrentUser();
  const tickets = useMyTickets();
  const router = useRouter();
  const [tab, setTab] = useState<"next" | "past">("next");
  const [now] = useState(() => Date.now());

  const initial = me.data?.user?.fullName?.charAt(0).toUpperCase() ?? "·";
  const all = useMemo(() => tickets.data ?? [], [tickets.data]);

  const { upcoming, past } = useMemo(() => {
    const up: typeof all = [];
    const ps: typeof all = [];
    for (const t of all) {
      const eventTime = new Date(t.event.startsAt).getTime();
      if (t.status === "used" || eventTime < now) ps.push(t);
      else up.push(t);
    }
    up.sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime());
    ps.sort((a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime());
    return { upcoming: up, past: ps };
  }, [all, now]);

  // Empty state — pixel-perfect BuyerTicketsEmpty
  if (!tickets.isLoading && all.length === 0) {
    return (
      <Phone>
        <TopBar
          hello="Mis entradas"
          title="Vacío"
          right={<ProfileMenu initials={initial} color="#FF4D5E" />}
        />
        <div
          style={{
            padding: "0 22px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: "calc(100dvh - 90px)",
          }}
        >
          <FannedTicketsHero />
          <div style={{ padding: "16px 0 24px" }}>
            <Btn onClick={() => router.push("/")}>Ver eventos</Btn>
          </div>
        </div>
      </Phone>
    );
  }

  const live = upcoming.find((t) => isToday(t.event.startsAt, now));
  const rest = upcoming.filter((t) => t.id !== live?.id);
  const list = tab === "next" ? upcoming : past;

  return (
    <Phone>
      <TopBar
        hello="Mis entradas"
        title={tab === "next" ? `${upcoming.length} próxima${upcoming.length === 1 ? "" : "s"}` : `${past.length} pasada${past.length === 1 ? "" : "s"}`}
        right={<ProfileMenu initials={initial} color="#FF4D5E" />}
      />

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
          <TicketTab label="Próximas" count={upcoming.length} on={tab === "next"} onClick={() => setTab("next")} />
          <TicketTab label="Pasadas" count={past.length} on={tab === "past"} onClick={() => setTab("past")} />
        </div>

        {tickets.isLoading && (
          <div style={{ padding: "60px 0", textAlign: "center", color: C.dim }}>Cargando…</div>
        )}

        {tab === "next" && live && (
          <>
            <div
              style={{
                fontSize: 11,
                color: C.dim,
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              ESTA NOCHE
            </div>
            <TicketCardLg
              title={live.event.title}
              venue={`${live.event.venue ?? ""} · ${formatDate(live.event.startsAt, live.event.timezone)}`}
              type={live.ticketType.name}
              countdown={`en ${formatCountdown(live.event.startsAt, now)}`}
              qrCode={live.qrCode}
              color1={PALETTE[0][0]}
              color2={PALETTE[0][1]}
              live
              onView={() => router.push(`/tickets/${live.id}`)}
            />
          </>
        )}

        {tab === "next" && rest.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                color: C.dim,
                letterSpacing: "0.08em",
                fontWeight: 600,
                marginTop: 18,
                marginBottom: 10,
              }}
            >
              PRÓXIMAS
            </div>
            {rest.map((t, i) => {
              const [c1, c2] = PALETTE[(i + 1) % PALETTE.length];
              return (
                <TicketCardSm
                  key={t.id}
                  title={t.event.title}
                  when={formatDate(t.event.startsAt, t.event.timezone)}
                  type={t.ticketType.name}
                  isBox={t.ticketType.kind === "box"}
                  color1={c1}
                  color2={c2}
                  onClick={() => router.push(`/tickets/${t.id}`)}
                />
              );
            })}
          </>
        )}

        {tab === "past" && past.length === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center", color: C.dim, fontSize: 13 }}>
            Aún no hay entradas pasadas.
          </div>
        )}

        {tab === "past" &&
          past.map((t, i) => {
            const [c1, c2] = PALETTE[(i + 2) % PALETTE.length];
            return (
              <TicketCardSm
                key={t.id}
                title={t.event.title}
                when={formatDate(t.event.startsAt, t.event.timezone)}
                type={`${t.ticketType.name} · usada`}
                color1={c1}
                color2={c2}
                onClick={() => router.push(`/tickets/${t.id}`)}
              />
            );
          })}

        {!tickets.isLoading && list.length === 0 && tab === "next" && (
          <div style={{ padding: "20px 0 8px" }}>
            <FannedTicketsHero />
            <div style={{ padding: "16px 0 24px" }}>
              <Link
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                href={"/" as any}
                style={{ textDecoration: "none" }}
              >
                <Btn>Ver eventos</Btn>
              </Link>
            </div>
          </div>
        )}
      </div>
    </Phone>
  );
}

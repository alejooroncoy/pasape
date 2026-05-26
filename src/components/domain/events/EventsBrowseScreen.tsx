"use client";

import { useState } from "react";
import {
  C,
  EventRow,
  FONT_DISPLAY,
  FilterChip,
  Phone,
  ProfileMenu,
  TopBar,
} from "@/components/design";
import { Link } from "@/i18n/navigation";
import { useBrowseEvents } from "@/lib/events/hooks/useEvents";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { formatDate, formatMoney } from "@/lib/_shared/format";

const FILTERS = ["Todos", "Hoy", "Finde", "Open air", "Centro"] as const;

const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#FF4D5E", "#FFCE3B"],
  ["#22D17F", "#7C3AED"],
  ["#7C3AED", "#22D17F"],
  ["#4B1F9A", "#FF4D5E"],
];

const GuestEnterButton = () => (
  <Link
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    href={"/auth/gate" as any}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      height: 38,
      padding: "0 14px",
      borderRadius: 14,
      background: "rgba(255,255,255,0.06)",
      boxShadow: `0 0 0 1px ${C.line} inset`,
      color: "#fff",
      fontFamily: FONT_DISPLAY,
      fontSize: 13,
      fontWeight: 650,
      textDecoration: "none",
    }}
  >
    Entrar
  </Link>
);

export const EventsBrowseScreen = () => {
  const me = useCurrentUser();
  const events = useBrowseEvents();
  const [active, setActive] = useState<string>("Todos");

  const isLoggedIn = !!me.data?.user;
  const initial = me.data?.user?.fullName?.charAt(0).toUpperCase() ?? "·";
  const greeting = me.data?.user?.fullName
    ? `Hola, ${me.data.user.fullName.split(" ")[0]}`
    : "Esta noche";

  const featured = events.data?.[0];
  const rest = events.data?.slice(1) ?? [];

  return (
    <Phone>
      <TopBar
        hello={greeting}
        title="Esta noche"
        right={
          isLoggedIn ? (
            <ProfileMenu initials={initial} color="#FF4D5E" />
          ) : (
            <GuestEnterButton />
          )
        }
      />

      <div style={{ padding: "0 22px", overflow: "auto", paddingBottom: 32 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            marginBottom: 16,
            paddingBottom: 4,
          }}
        >
          {FILTERS.map((label) => (
            <FilterChip
              key={label}
              label={label}
              on={label === active}
              onClick={() => setActive(label)}
            />
          ))}
        </div>

        {events.isLoading && (
          <div style={{ color: C.dim, fontSize: 13, padding: "60px 0", textAlign: "center" }}>
            Cargando…
          </div>
        )}
        {events.error && (
          <div style={{ color: C.red, fontSize: 13, padding: "60px 0", textAlign: "center" }}>
            No pudimos cargar los eventos.
          </div>
        )}
        {events.data && events.data.length === 0 && (
          <div style={{ color: C.dim, fontSize: 13, padding: "60px 0", textAlign: "center" }}>
            Pronto habrá fiesta. Vuelvé en unos días.
          </div>
        )}

        {featured && (
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={`/events/${featured.slug}` as any}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div
              style={{
                borderRadius: 22,
                padding: 16,
                marginBottom: 12,
                background: "linear-gradient(150deg, #4B1F9A 0%, #7C3AED 50%, #FF4D5E 110%)",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.1) inset, 0 20px 40px -10px rgba(124,58,237,0.4)",
                position: "relative",
                overflow: "hidden",
                minHeight: 220,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.85)",
                    fontWeight: 700,
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  DESTACADO
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)" }}>
                  {formatDate(featured.startsAt, featured.timezone)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: "-0.035em",
                    lineHeight: 0.95,
                  }}
                >
                  {featured.title}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                  }}
                >
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                    {featured.venue ?? ""}
                  </div>
                  {featured.capacity.totalCapacity != null && (
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>
                      {featured.capacity.totalCapacity} aforo
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                color: C.dim,
                letterSpacing: "0.08em",
                fontWeight: 600,
                margin: "8px 0 10px",
              }}
            >
              ESTE FINDE
            </div>
            {rest.map((event, i) => {
              const [c1, c2] = PALETTE[i % PALETTE.length];
              return (
                <Link
                  key={event.id}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={`/events/${event.slug}` as any}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <EventRow
                    title={event.title}
                    venue={`${event.venue ?? "—"} · ${formatDate(event.startsAt, event.timezone)}`}
                    price={event.capacity.totalCapacity ? formatMoney(0) : "—"}
                    color1={c1}
                    color2={c2}
                  />
                </Link>
              );
            })}
          </>
        )}
      </div>
    </Phone>
  );
};

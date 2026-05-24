"use client";

import {
  Arrow,
  Btn,
  C,
  FONT_DISPLAY,
  LiveDot,
  Phone,
  ProfileMenu,
  Stat,
  TopBar,
} from "@/components/design";
import { Link } from "@/i18n/navigation";
import { useMyEvents } from "@/lib/events/hooks/useEvents";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useMyOrgs } from "@/lib/identity/organizations/hooks/useMyOrgs";
import { formatDate, formatMoney } from "@/lib/_shared/format";
import { OrgSwitcherButton } from "@/components/domain/identity/OrgSwitcherButton";

export default function OrgHomePage() {
  const me = useCurrentUser();
  const orgs = useMyOrgs();
  const events = useMyEvents();

  const activeOrg = orgs.data?.find((o) => o.slug === me.data?.activeOrgSlug) ?? orgs.data?.[0];
  const initial = (activeOrg?.name ?? me.data?.user?.fullName ?? "·").charAt(0).toUpperCase();
  const greeting = me.data?.user?.fullName
    ? `Hola, ${me.data.user.fullName.split(" ")[0]}`
    : "Hola";

  const liveEvent = events.data?.find((e) => e.status === "published");

  return (
    <Phone>
      <TopBar
        hello={greeting}
        title={activeOrg?.name ?? "Tu agenda"}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <OrgSwitcherButton />
            <ProfileMenu initials={initial} color={C.purple} />
          </div>
        }
      />

      <div style={{ padding: "0 22px 110px" }}>
        {!orgs.data || orgs.data.length === 0 ? (
          <OrgEmpty />
        ) : liveEvent ? (
          <>
            <div
              style={{
                borderRadius: 28,
                padding: 22,
                background:
                  "linear-gradient(180deg, rgba(124,58,237,0.22), rgba(124,58,237,0.04) 60%, rgba(255,255,255,0.02))",
                boxShadow:
                  "0 0 0 1px rgba(124,58,237,0.35) inset, 0 30px 60px -30px rgba(124,58,237,0.55)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 180,
                  height: 180,
                  borderRadius: 999,
                  background:
                    "radial-gradient(closest-side, rgba(124,58,237,0.55), transparent 70%)",
                  filter: "blur(20px)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                  position: "relative",
                }}
              >
                <LiveDot />
                <span style={{ fontSize: 12, color: C.dim }}>
                  {formatDate(liveEvent.startsAt, liveEvent.timezone)}
                </span>
              </div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                  marginBottom: 4,
                  position: "relative",
                }}
              >
                {liveEvent.title}
              </div>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 22, position: "relative" }}>
                {liveEvent.venue ?? "—"}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 14,
                  position: "relative",
                }}
              >
                <Stat n={String(liveEvent.capacity.totalCapacity ?? 0)} k="Aforo" />
                <Stat n="0" k="Validadas" tone="green" />
                <Stat n={formatMoney(0)} k="Recaudado" tone="purple" big />
              </div>
            </div>

            <Link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/org/events/${liveEvent.slug}` as any}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                style={{
                  marginTop: 14,
                  padding: "14px 18px",
                  background: C.bg2,
                  borderRadius: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: `0 0 0 1px ${C.line} inset`,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.04em" }}>
                    PANEL EN VIVO
                  </div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600, marginTop: 2 }}>
                    Ver ventas y accesos →
                  </div>
                </div>
                <Arrow />
              </div>
            </Link>
          </>
        ) : (
          <OrgEmpty />
        )}

        {events.data && events.data.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: C.dim, letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>
              TUS EVENTOS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {events.data.map((e) => (
                <div
                  key={e.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 16,
                    background: C.bg2,
                    boxShadow: `0 0 0 1px ${C.line} inset`,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, #4B1F9A, #7C3AED)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>
                      {formatDate(e.startsAt, e.timezone)} · {e.venue ?? ""}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background:
                        e.status === "published"
                          ? "rgba(34,209,127,0.16)"
                          : "rgba(255,255,255,0.06)",
                      color: e.status === "published" ? C.green : C.dim,
                    }}
                  >
                    {e.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 390,
          padding: "0 22px",
        }}
      >
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={"/org/events/new" as any}
          style={{ textDecoration: "none" }}
        >
          <Btn>+ Crear evento</Btn>
        </Link>
      </div>
    </Phone>
  );
}

const OrgEmpty = () => (
  <>
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.14em",
          color: C.purple,
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        ◆ TU PRIMERA NOCHE
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "-0.035em",
          lineHeight: 0.95,
        }}
      >
        Arma tu evento
        <br />
        <span style={{ color: C.purple, fontStyle: "italic", fontWeight: 600 }}>en un minuto.</span>
      </div>
    </div>

    <div
      style={{
        position: "relative",
        height: 280,
        borderRadius: 22,
        background:
          "radial-gradient(120% 80% at 50% 0%, rgba(124,58,237,0.18), transparent 70%), " + C.bg2,
        boxShadow: `0 0 0 1px ${C.line} inset`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.5,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(80% 60% at 50% 50%, #000 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(80% 60% at 50% 50%, #000 30%, transparent 80%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          fontSize: 10,
          letterSpacing: "0.16em",
          color: C.dimmer,
          fontWeight: 600,
        }}
      >
        VISTA PREVIA
      </div>
      <div
        style={{
          position: "absolute",
          top: 44,
          left: 22,
          width: 168,
          height: 222,
          borderRadius: 18,
          background: "linear-gradient(150deg, #4B1F9A 0%, #7C3AED 50%, #FF4D5E 110%)",
          boxShadow:
            "0 30px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1) inset",
          transform: "rotate(-6deg)",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#fff",
              boxShadow: "0 0 8px #fff",
            }}
          />
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            SÁB · 22H
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
              color: "#fff",
            }}
          >
            Tu evento
            <br />
            aquí.
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.7)" }}>
            Barranco · Lima
          </div>
        </div>
      </div>
    </div>

    <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: C.dim }}>
      Sin tarjeta · publicas y compartes en 60 segundos
    </div>
  </>
);

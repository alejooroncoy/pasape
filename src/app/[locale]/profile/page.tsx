"use client";

import { Arrow, BackBtn, C, FONT_DISPLAY, Phone } from "@/components/design";
import { Link, useRouter } from "@/i18n/navigation";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useSignOut } from "@/lib/identity/hooks/useFirebaseAuth";

const initialsOf = (name: string | null | undefined) => {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
};

const Stat = ({ n, k, middle }: { n: string; k: string; middle?: boolean }) => (
  <div
    style={{
      textAlign: "center",
      borderLeft: middle ? `1px solid ${C.line}` : "none",
      borderRight: middle ? `1px solid ${C.line}` : "none",
    }}
  >
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        lineHeight: 1,
      }}
    >
      {n}
    </div>
    <div
      style={{
        fontSize: 10,
        color: C.dim,
        marginTop: 6,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {k}
    </div>
  </div>
);

const ProfRow = ({
  icon,
  label,
  sub,
  href,
  danger,
  last,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  href?: string;
  danger?: boolean;
  last?: boolean;
  onClick?: () => void;
}) => {
  const router = useRouter();
  const handleClick = onClick
    ? onClick
    : href
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => router.push(href as any)
      : undefined;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 4px",
        borderBottom: last ? "none" : `1px solid ${C.line}`,
        cursor: handleClick ? "pointer" : "default",
      }}
      onClick={handleClick}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: danger ? C.redSoft : "rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: danger ? C.red : "#fff",
          }}
        >
          {label}
        </div>
        {sub && <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{sub}</div>}
      </div>
      {!danger && <Arrow />}
    </div>
  );
};

const IconCard = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="4" width="14" height="10" rx="1.6" stroke={C.purple} strokeWidth="1.4" />
    <path d="M2 7h14" stroke={C.purple} strokeWidth="1.4" />
  </svg>
);
const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path
      d="M4 12V8a5 5 0 0 1 10 0v4l1.5 2h-13L4 12Z"
      stroke={C.purple}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M7 15a2 2 0 0 0 4 0" stroke={C.purple} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
const IconHeart = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path
      d="M9 15s-6-4-6-8a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8Z"
      stroke={C.purple}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);
const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path
      d="M9 2L3 4v5c0 3.5 2.5 6.5 6 8 3.5-1.5 6-4.5 6-8V4L9 2Z"
      stroke={C.purple}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);
const IconBuilding = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="3" y="3" width="12" height="12" rx="1.5" stroke={C.purple} strokeWidth="1.4" />
    <path
      d="M6 6h1M6 9h1M6 12h1M11 6h1M11 9h1M11 12h1"
      stroke={C.purple}
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);
const IconHelp = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke={C.purple} strokeWidth="1.4" />
    <path
      d="M7 7.5c.3-1 1.1-1.5 2-1.5 1.2 0 2 .8 2 1.7 0 .8-.5 1.2-1 1.5-.7.4-1 .8-1 1.3M9 13v.1"
      stroke={C.purple}
      strokeWidth="1.4"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);
const IconOut = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path
      d="M11 4H4v10h7M14 9H7M11 6l3 3-3 3"
      stroke={C.red}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export default function BuyerProfilePage() {
  const { data, isLoading } = useCurrentUser();
  const signOut = useSignOut();

  const user = data?.user ?? null;
  const fullName = user?.fullName ?? "Tu perfil";
  const sub = user?.email ?? user?.phone ?? "";

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
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>TU PERFIL</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ padding: "8px 22px" }}>
        <div
          style={{
            borderRadius: 24,
            padding: 20,
            position: "relative",
            overflow: "hidden",
            background: `radial-gradient(120% 80% at 30% 0%, rgba(124,58,237,0.32), transparent 70%), ${C.bg2}`,
            boxShadow: `0 0 0 1px ${C.purpleEdge} inset`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: "linear-gradient(135deg, #FF4D5E, #7C3AED 60%, #4B1F9A)",
                boxShadow:
                  "0 0 0 2px rgba(255,255,255,0.1), 0 20px 40px -10px rgba(124,58,237,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT_DISPLAY,
                fontWeight: 800,
                fontSize: 26,
                color: "#fff",
                letterSpacing: "-0.02em",
              }}
            >
              {initialsOf(fullName).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
                  lineHeight: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {isLoading ? "Cargando…" : fullName}
              </div>
              {sub && (
                <div
                  style={{
                    fontSize: 12,
                    color: C.dim,
                    marginTop: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {sub}
                </div>
              )}
            </div>
            <Link
              href="/profile/edit"
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: 0,
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontFamily: FONT_DISPLAY,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textDecoration: "none",
              }}
            >
              EDITAR
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              padding: "14px 0",
              borderTop: `1px solid ${C.line}`,
              borderBottom: `1px solid ${C.line}`,
            }}
          >
            <Stat n="0" k="entradas" />
            <Stat n="S/0" k="ahorros" middle />
            <Stat n="0" k="noches" />
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 11,
            color: C.dim,
            letterSpacing: "0.08em",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          CUENTA
        </div>
        <ProfRow icon={<IconCard />} label="Métodos de pago" sub="Yape · tarjetas" href="/profile/payment-methods" />
        <ProfRow icon={<IconBell />} label="Notificaciones" sub="WhatsApp · email" href="/profile/notifications" />
        <ProfRow icon={<IconHeart />} label="Organizadores que sigues" href="/profile/following" />
        {data?.activeOrgSlug && (
          <ProfRow
            icon={<IconBuilding />}
            label="Tu marca"
            sub={`@${data.activeOrgSlug}`}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={`/org/${data.activeOrgSlug}` as any}
          />
        )}
        <ProfRow icon={<IconShield />} label="Privacidad y datos" last />

        <div
          style={{
            marginTop: 14,
            fontSize: 11,
            color: C.dim,
            letterSpacing: "0.08em",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          AYUDA
        </div>
        <ProfRow icon={<IconHelp />} label="Reportar un problema" />
        <ProfRow icon={<IconOut />} label="Cerrar sesión" danger last onClick={() => void signOut()} />
      </div>
    </Phone>
  );
}

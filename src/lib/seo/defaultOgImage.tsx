import { ImageResponse } from "next/og";

export const DEFAULT_OG_SIZE = { width: 1200, height: 630 };

// Paleta clara (home-light): la app del consumidor se rediseñó a claro, así que
// el OG que la representa va en la misma piel. Sombras suaves de marca
// (morado + azul) en las tarjetas, sin saturar. Ver globals.css .home-light.
const BG = "#fbfaff";
const INK = "#1c1030"; // texto principal (near-black morado)
const INK_MUTED = "#6b6480";
const ACCENT = "#7c3aed";
const BLUE = "#4f6df5";
const GREEN = "#15a35a"; // más oscuro que el dark para leer sobre claro
const CARD = "#ffffff";
const CARD_BORDER = "rgba(28,16,48,0.08)";
const SUBTLE = "#f3f1fb"; // paneles internos (cart-bg-elev light)
const LINE = "rgba(28,16,48,0.08)";
// Sombra de marca reutilizable: morado + azul, suave (como las cart-cards).
const CARD_SHADOW =
  "0 30px 80px rgba(124,58,237,0.16), 0 10px 26px rgba(79,109,245,0.10)";

export async function createDefaultOgImage() {
  const [logoSrc, fonts] = await Promise.all([loadLogo(), loadFonts()]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          overflow: "hidden",
          background: BG,
          color: INK,
          fontFamily: "Pasape Sans",
        }}
      >
        <BackgroundTexture />

        <div
          style={{
            position: "absolute",
            left: 74,
            top: 62,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            // Perrito oscuro cuadrado: se lee sobre el fondo claro (el logo-mark
            // era solo la orejita lavanda, casi invisible en claro).
            <img src={logoSrc} width={42} height={42} alt="" />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
              Pasape
            </span>
            <span style={{ fontSize: 15, color: INK_MUTED, fontWeight: 400 }}>
              Sistema operativo para eventos
            </span>
          </div>
        </div>

        <main
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            height: "100%",
            display: "flex",
            padding: "130px 70px 58px",
            gap: 48,
          }}
        >
          <section
            style={{
              width: 570,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                alignItems: "center",
                gap: 10,
                padding: "9px 14px",
                borderRadius: 999,
                border: `1px solid ${ACCENT}2e`,
                background: "rgba(124,58,237,0.07)",
                color: "#5b28c0",
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  background: ACCENT,
                  display: "flex",
                }}
              />
              Compra web · QR único · Panel en vivo
            </div>

            <h1
              style={{
                display: "flex",
                flexDirection: "column",
                margin: "28px 0 0",
                fontSize: 78,
                lineHeight: 0.98,
                letterSpacing: -3.1,
                fontWeight: 700,
              }}
            >
              <span>Vende entradas.</span>
              <span
                style={{
                  color: ACCENT,
                  fontFamily: "Pasape Sans",
                  fontWeight: 400,
                  letterSpacing: -1.2,
                }}
              >
                Controla todo.
              </span>
            </h1>

            <p
              style={{
                margin: "24px 0 0",
                maxWidth: 548,
                color: INK_MUTED,
                fontSize: 23,
                lineHeight: 1.32,
                fontWeight: 400,
              }}
            >
              Te damos la infraestructura para vender entradas, controlar
              accesos y tomar decisiones con datos, sin cargarle más trabajo a
              tu equipo.
            </p>
          </section>

          <section
            style={{
              position: "relative",
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ProductPreview />
          </section>
        </main>
      </div>
    ),
    { ...DEFAULT_OG_SIZE, fonts },
  );
}

function BackgroundTexture() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 48% at 32% 20%, rgba(124,58,237,0.10), transparent 60%), radial-gradient(ellipse 46% 40% at 88% 78%, rgba(79,109,245,0.09), transparent 62%), " +
            BG,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 660,
          top: -90,
          width: 520,
          height: 820,
          border: "1px solid rgba(124,58,237,0.10)",
          transform: "rotate(13deg)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.05))",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 1,
          background:
            "linear-gradient(90deg, rgba(124,58,237,0), rgba(124,58,237,0.22), rgba(124,58,237,0))",
          display: "flex",
        }}
      />
    </div>
  );
}

function ProductPreview() {
  return (
    <div
      style={{
        position: "relative",
        width: 500,
        height: 430,
        display: "flex",
      }}
    >
      <DashboardCard />
      <TicketCard />
      <FanPassCard />
    </div>
  );
}

function DashboardCard() {
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 24,
        width: 386,
        height: 298,
        borderRadius: 28,
        background: CARD,
        border: `1px solid ${CARD_BORDER}`,
        boxShadow: CARD_SHADOW,
        padding: 22,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ color: INK_MUTED, fontSize: 13, fontWeight: 700 }}>
            EN VIVO
          </span>
          <span style={{ fontSize: 25, fontWeight: 700, color: INK }}>Evento Demo</span>
        </div>
        <LiveBadge />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <Kpi
          title="Ventas"
          value="319"
          detail="72% del objetivo"
          progress={72}
          accent={ACCENT}
        />
        <Kpi
          title="Accesos"
          value="287"
          detail="90% validadas"
          progress={90}
          accent={GREEN}
        />
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 18,
          height: 88,
          borderRadius: 18,
          background: SUBTLE,
          border: `1px solid ${LINE}`,
          padding: "14px 14px 12px",
          gap: 11,
        }}
      >
        {[30, 48, 34, 60, 43, 70, 52].map((height, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                width: "100%",
                height,
                borderRadius: 8,
                background:
                  index === 5
                    ? ACCENT
                    : index === 3
                      ? GREEN
                      : "rgba(28,16,48,0.12)",
                display: "flex",
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketCard() {
  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        bottom: 22,
        width: 286,
        height: 164,
        borderRadius: 24,
        background: CARD,
        color: INK,
        border: `1px solid ${CARD_BORDER}`,
        boxShadow: CARD_SHADOW,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transform: "rotate(-5deg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
            PASAPE
          </span>
          <span style={{ fontSize: 28, lineHeight: 1.04, fontWeight: 700 }}>
            Tu entrada
          </span>
          <span style={{ color: INK_MUTED, fontSize: 13, fontWeight: 700 }}>
            lista para entrar
          </span>
        </div>
        <TicketStamp />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Bar width={82} color={INK} />
        <Bar width={48} color="rgba(28,16,48,0.28)" />
        <Bar width={72} color="rgba(28,16,48,0.16)" />
      </div>
    </div>
  );
}

function FanPassCard() {
  return (
    <div
      style={{
        position: "absolute",
        right: 18,
        bottom: 4,
        width: 184,
        height: 168,
        borderRadius: 30,
        background: CARD,
        color: INK,
        border: `1px solid ${CARD_BORDER}`,
        boxShadow: CARD_SHADOW,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transform: "rotate(7deg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ color: ACCENT, fontSize: 12, fontWeight: 700 }}>
            FAN PASS
          </span>
          <span style={{ fontSize: 24, lineHeight: 1, fontWeight: 700 }}>
            Listo
          </span>
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: GREEN,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
          }}
        >
          <CheckMark color="#ffffff" size={18} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 12px",
          borderRadius: 18,
          background: SUBTLE,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>Vie · 10:00 p.m.</span>
        <span style={{ color: INK_MUTED, fontSize: 12, fontWeight: 700 }}>
          Guardado en tu celular
        </span>
      </div>
    </div>
  );
}

function TicketStamp() {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 18,
        background: ACCENT,
        color: "#fff",
        fontSize: 30,
        fontWeight: 700,
        transform: "rotate(3deg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CheckMark color="#FFFFFF" size={22} />
    </div>
  );
}

function CheckMark({ color, size }: { color: string; size: number }) {
  const stroke = Math.max(2.5, size * 0.14);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "flex" }}
    >
      <path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Kpi({
  title,
  value,
  detail,
  progress,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  progress: number;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 16,
        background: SUBTLE,
        border: `1px solid ${LINE}`,
        padding: 13,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ color: INK_MUTED, fontSize: 12, fontWeight: 700 }}>
          {title}
        </span>
        <span style={{ color: accent, fontSize: 12, fontWeight: 700 }}>
          {progress}%
        </span>
      </div>
      <span style={{ color: INK, fontSize: 31, lineHeight: 1, fontWeight: 700 }}>
        {value}
      </span>
      <div
        style={{
          height: 5,
          borderRadius: 99,
          background: "rgba(28,16,48,0.10)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <span
          style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: 99,
            background: accent,
            display: "flex",
          }}
        />
      </div>
      <span style={{ color: INK_MUTED, fontSize: 11, fontWeight: 600 }}>
        {detail}
      </span>
    </div>
  );
}

function LiveBadge() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        alignSelf: "flex-start",
        borderRadius: 999,
        background: "rgba(21,163,90,0.12)",
        color: GREEN,
        padding: "7px 10px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 7,
          background: GREEN,
          display: "flex",
        }}
      />
      LIVE
    </div>
  );
}

function Bar({ width, color }: { width: number; color: string }) {
  return (
    <span
      style={{
        width,
        height: 8,
        borderRadius: 99,
        background: color,
        display: "flex",
      }}
    />
  );
}

async function loadLogo(): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(
      join(process.cwd(), "public/icons/logo-dark-square-512.png"),
    );
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function loadFonts() {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const fontPath = (...parts: string[]) =>
    join(process.cwd(), "public/fonts", ...parts);

  const [sans, sansBold] = await Promise.all([
    readFile(fontPath("geist-sans-latin-400-normal.woff")),
    readFile(fontPath("geist-sans-latin-700-normal.woff")),
  ]);

  return [
    {
      name: "Pasape Sans",
      data: sans,
      style: "normal" as const,
      weight: 400 as const,
    },
    {
      name: "Pasape Sans",
      data: sansBold,
      style: "normal" as const,
      weight: 700 as const,
    },
  ];
}

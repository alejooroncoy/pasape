import { ImageResponse } from "next/og";
import { serverApiGet } from "@/lib/_shared/server-api";
import type { Event, Promo, TicketType } from "@/server/events/domain/Event";
import { SITE_NAME } from "@/lib/seo/site";

type EventDetailResponse = { event: Event; ticketTypes: TicketType[]; promos: Promo[] };

export const runtime = "nodejs";
export const alt = "Pasape evento";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Paleta clara (home-light), coherente con el OG del home y la app. El flyer del
// evento manda (es un card protagonista + textura tenue de fondo), pero el marco
// va claro con sombra suave de marca. El scrim de fondo es PLANO (no gradiente)
// y casi opaco: deja pasar un tinte de los colores del flyer sin comprometer la
// legibilidad del texto oscuro. Ver defaultOgImage.tsx.
const BG = "#fbfaff";
const INK = "#1c1030";
const INK_MUTED = "#6b6480";
const ACCENT = "#7c3aed";
const SUBTLE = "#f3f1fb";
const CARD = "#ffffff";
const CARD_BORDER = "rgba(28,16,48,0.08)";
const CARD_SHADOW =
  "0 30px 80px rgba(124,58,237,0.18), 0 10px 26px rgba(79,109,245,0.12)";

export default async function EventOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [logoSrc, fonts] = await Promise.all([loadLogo(), loadFonts()]);

  let title = "Evento en Pasape";
  let venue = "Lima";
  let coverUrl: string | null = null;

  try {
    const { event } = await serverApiGet<EventDetailResponse>(`/api/events/${slug}`);
    title = event.title;
    venue = event.venue?.trim() || "Lima";
    coverUrl = event.coverUrl;
  } catch {
    // Fallback visual si el evento no se puede resolver.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: BG,
          overflow: "hidden",
          color: INK,
          fontFamily: "Pasape Sans",
        }}
      >
        {/* Fondo claro limpio con glows suaves de marca (morado + azul, baja
            opacidad). NO usamos el flyer difuminado full-bleed: un flyer oscuro
            ensuciaba el fondo con un manchón gris. El flyer protagoniza en la
            card de la derecha, siempre nítido, y el texto oscuro queda legible
            sobre cualquier evento. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 52% 46% at 22% 24%, rgba(124,58,237,0.12), transparent 60%), radial-gradient(ellipse 46% 42% at 82% 82%, rgba(79,109,245,0.10), transparent 62%), " +
              BG,
            display: "flex",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            height: "100%",
            display: "flex",
            padding: "54px 58px",
            gap: 34,
          }}
        >
          <section
            style={{
              width: 620,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                alignItems: "center",
                gap: 12,
                padding: "10px 18px",
                borderRadius: 999,
                border: `1px solid ${CARD_BORDER}`,
                background: CARD,
                boxShadow: "0 8px 24px rgba(124,58,237,0.12)",
                fontSize: 24,
                fontWeight: 700,
                color: INK,
              }}
            >
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} width={30} height={30} alt="" />
              ) : (
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 10,
                    background: ACCENT,
                    display: "flex",
                  }}
                />
              )}
              {SITE_NAME}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  fontSize: 76,
                  lineHeight: 0.98,
                  fontWeight: 800,
                  letterSpacing: -2.6,
                  maxWidth: 610,
                  color: INK,
                }}
              >
                {title}
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: "#ffffff",
                    background: ACCENT,
                    borderRadius: 999,
                    padding: "8px 16px",
                  }}
                >
                  {venue}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignSelf: "flex-start",
                  marginTop: 8,
                  padding: "14px 26px",
                  borderRadius: 999,
                  background: ACCENT,
                  color: "#FFFFFF",
                  fontSize: 29,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  boxShadow: "0 14px 34px rgba(124,58,237,0.30)",
                }}
              >
                Compra tu entrada
              </div>
            </div>
          </section>

          <section
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 420,
                height: 520,
                borderRadius: 44,
                background: CARD,
                border: `1px solid ${CARD_BORDER}`,
                boxShadow: CARD_SHADOW,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt=""
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 420,
                    height: 360,
                    objectFit: "cover",
                    objectPosition: "center top",
                    display: "flex",
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 420,
                    height: 360,
                    background: SUBTLE,
                    display: "flex",
                  }}
                />
              )}

              <div
                style={{
                  position: "relative",
                  marginTop: 360,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "20px 24px",
                  background: CARD,
                }}
              >
                <span
                  style={{
                    color: ACCENT,
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                  }}
                >
                  EVENTO EN VIVO
                </span>
                <span
                  style={{
                    color: INK,
                    fontSize: 32,
                    lineHeight: 1.05,
                    fontWeight: 700,
                  }}
                >
                  {title}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

async function loadLogo(): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    // Perrito oscuro cuadrado: se lee sobre el marco claro (el logo-icon-min era
    // solo la orejita lavanda, invisible en claro).
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

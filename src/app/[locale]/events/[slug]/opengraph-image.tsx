import { ImageResponse } from "next/og";
import { serverApiGet } from "@/lib/_shared/server-api";
import type { Event, Promo, TicketType } from "@/server/events/domain/Event";
import { SITE_NAME } from "@/lib/seo/site";

type EventDetailResponse = { event: Event; ticketTypes: TicketType[]; promos: Promo[] };

export const runtime = "nodejs";
export const alt = "Pasape evento";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
          background: "#08070f",
          overflow: "hidden",
          color: "#fff",
          fontFamily: "Pasape Sans",
        }}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(28px) saturate(1.2)",
              transform: "scale(1.1)",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(112deg, rgba(8,7,15,0.95) 0%, rgba(10,8,20,0.82) 42%, rgba(78,33,150,0.52) 100%)",
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
                border: "1px solid rgba(255,255,255,0.20)",
                background: "rgba(16,14,28,0.50)",
                fontSize: 24,
                fontWeight: 700,
                color: "#F3ECFF",
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
                    background: "#B87CFF",
                    boxShadow: "0 0 20px rgba(184,124,255,0.8)",
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
                }}
              >
                {title}
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: "#0D0B17",
                    background: "#B87CFF",
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
                  border: "1px solid rgba(255,255,255,0.26)",
                  background:
                    "linear-gradient(120deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))",
                  color: "#FFFFFF",
                  fontSize: 29,
                  fontWeight: 700,
                  letterSpacing: 0.2,
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
                background: "#0D0B17",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.14), 0 34px 90px rgba(0,0,0,0.48)",
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
                    background:
                      "linear-gradient(150deg,#0f0020 0%,#3b0764 40%,#7c3aed 100%)",
                    display: "flex",
                  }}
                />
              )}

              <div
                style={{
                  position: "relative",
                  marginTop: 352,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "20px 24px",
                  background:
                    "linear-gradient(180deg, rgba(13,11,23,0.72), rgba(13,11,23,0.96))",
                }}
              >
                <span
                  style={{
                    color: "#BFB4D8",
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: 0.5,
                  }}
                >
                  EVENTO EN VIVO
                </span>
                <span
                  style={{
                    color: "#FFFFFF",
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
    const buf = await readFile(
      join(process.cwd(), "public/icons/logo-icon-min-512.png"),
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

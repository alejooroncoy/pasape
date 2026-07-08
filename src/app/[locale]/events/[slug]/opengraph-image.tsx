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
              filter: "blur(24px) saturate(1.25)",
              transform: "scale(1.08)",
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(120deg, rgba(8,7,15,0.88) 0%, rgba(12,10,24,0.80) 35%, rgba(84,36,160,0.42) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "58px 64px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.24)",
              color: "#f3ecff",
              fontSize: 28,
              fontWeight: 700,
              background: "rgba(13,11,22,0.42)",
            }}
          >
            {SITE_NAME}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                fontSize: 70,
                lineHeight: 1.05,
                color: "#ffffff",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                maxWidth: 1050,
              }}
            >
              {title}
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#0f0d17",
                  background: "#b87cff",
                  borderRadius: 999,
                  padding: "8px 18px",
                }}
              >
                Evento
              </span>
              <span style={{ fontSize: 30, fontWeight: 500, color: "#d6d1e5" }}>{venue}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

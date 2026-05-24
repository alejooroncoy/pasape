"use client";

import { use } from "react";
import { BackBtn, Btn, C, EventRow, FONT_DISPLAY, Phone } from "@/components/design";
import { Link } from "@/i18n/navigation";
import { useEvent, useBrowseEvents } from "@/lib/events/hooks/useEvents";

type Props = { params: Promise<{ slug: string }> };

export default function BuyerSoldOutPage({ params }: Props) {
  const { slug } = use(params);
  const { data } = useEvent(slug);
  const browse = useBrowseEvents();

  const suggestions = (browse.data ?? [])
    .filter((e) => e.slug !== slug && e.status === "published")
    .slice(0, 2);

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
        <div style={{ width: 38 }} />
      </div>
      <div
        style={{
          padding: "32px 22px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "calc(100dvh - 50px)",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 10px",
              borderRadius: 999,
              background: C.redSoft,
              color: C.red,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              alignSelf: "flex-start",
            }}
          >
            ● AGOTADO
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              marginTop: 14,
            }}
          >
            Se acabaron
            <br />
            las entradas.
          </div>
          <div style={{ fontSize: 15, color: C.dim, marginTop: 14, lineHeight: 1.5 }}>
            <strong style={{ color: "#fff" }}>{data?.event.title ?? "Este evento"}</strong> está lleno.
            <br />
            Te avisamos si alguien transfiere su entrada.
          </div>
        </div>

        {suggestions.length > 0 && (
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
              PROBÁ ESTOS
            </div>
            {suggestions.map((ev, i) => (
              <Link
                key={ev.id}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                href={`/events/${ev.slug}` as any}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <EventRow
                  title={ev.title}
                  venue={ev.venue ?? ""}
                  price={"S/ —"}
                  color1={i === 0 ? "#FF4D5E" : "#22D17F"}
                  color2={i === 0 ? "#FFCE3B" : "#7C3AED"}
                />
              </Link>
            ))}
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <Btn>Avisame si hay cupos</Btn>
        </div>
      </div>
    </Phone>
  );
}

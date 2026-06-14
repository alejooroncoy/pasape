"use client";

import { use } from "react";
import { Btn, C, FONT_DISPLAY, Phone } from "@/components/design";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useEventStats } from "@/lib/events/hooks/useEventStats";
import { useRealtimeEventStats } from "@/lib/events/hooks/useRealtimeEventStats";
import { formatMoney } from "@/lib/_shared/format";
import { BackBtn } from "../_components";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgReportPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const event = useEvent(slug);
  const stats = useEventStats(slug);
  // Consistente con las otras pantallas: KPIs en vivo vía Broadcast (no solo polling).
  useRealtimeEventStats(event.data?.event?.id, slug);

  const ev = event.data?.event;
  const sold = stats.data?.sold ?? 0;
  const validated = stats.data?.validated ?? 0;
  const noShow = Math.max(0, sold - validated);
  const revenue = stats.data?.revenueCents ?? 0;

  const subtitle = ev
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: ev.timezone,
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date(ev.startsAt))
    : "—";

  return (
    <Phone>
      <div
        style={{
          padding: "6px 22px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <BackBtn />
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.06em" }}>
          {ev?.status === "closed" || ev?.status === "cancelled" ? "REPORTE FINAL" : "AVANCE EN VIVO"}
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 22px 24px" }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.025em",
          }}
        >
          {ev?.title ?? "—"}
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 18 }}>{subtitle}</div>

        <div
          style={{
            borderRadius: 20,
            padding: "18px 18px",
            background: "linear-gradient(180deg, rgba(124,58,237,0.16), rgba(124,58,237,0.02))",
            boxShadow: `0 0 0 1px ${C.purpleEdge} inset`,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: C.dim,
              letterSpacing: "0.06em",
              marginBottom: 4,
            }}
          >
            TOTAL RECAUDADO
          </div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {formatMoney(revenue, ev?.currency)}
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 12,
              fontSize: 13,
              flexWrap: "wrap",
            }}
          >
            <span>
              <strong style={{ color: "#fff" }}>{sold}</strong>{" "}
              <span style={{ color: C.dim }}>vendidas</span>
            </span>
            <span>
              <strong style={{ color: C.green }}>{validated}</strong>{" "}
              <span style={{ color: C.dim }}>asistieron</span>
            </span>
            <span>
              <strong style={{ color: C.dim }}>{noShow}</strong>{" "}
              <span style={{ color: C.dim }}>no asistieron</span>
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            color: C.dim,
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          DESGLOSE POR ENTRADA
        </div>
        <div
          style={{
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: `0 0 0 1px ${C.line} inset`,
            background: C.bg2,
          }}
        >
          {(stats.data?.ticketTypes ?? []).map((t, i, arr) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 14px",
                borderBottom: i < arr.length - 1 ? "1px solid " + C.line : "none",
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 11, color: C.dim }}>
                  {t.sold} de {t.capacity} vendidas
                </div>
              </div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>
                {formatMoney(t.revenueCents, ev?.currency)}
              </div>
            </div>
          ))}
          {(stats.data?.ticketTypes ?? []).length === 0 && (
            <div style={{ padding: 18, fontSize: 13, color: C.dim, textAlign: "center" }}>
              Sin datos
            </div>
          )}
        </div>
      </div>

      <div
        style={{ padding: "0 22px 32px", display: "flex", gap: 10, flexShrink: 0 }}
      >
        <Btn
          kind="green"
          style={{ flex: 1 }}
          onClick={() => window.open(`/api/events/${slug}/export`, "_blank")}
        >
          Exportar Excel
        </Btn>
      </div>
    </Phone>
  );
}

"use client";

import { use } from "react";
import { C, FONT_DISPLAY, LiveDot, Phone } from "@/components/design";
import { Link } from "@/i18n/navigation";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useEventStats } from "@/lib/events/hooks/useEventStats";
import { formatMoney } from "@/lib/_shared/format";
import { BackBtn, LiveBottomNav } from "./_components";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgLivePanelPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const event = useEvent(slug);
  const stats = useEventStats(slug);

  const ev = event.data?.event;
  const title = ev?.title ?? "Cargando…";
  const time = ev
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: ev.timezone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(ev.startsAt))
    : "";

  const sold = stats.data?.sold ?? 0;
  const validated = stats.data?.validated ?? 0;
  const revenue = stats.data?.revenueCents ?? 0;

  return (
    <Phone>
      <div
        style={{
          padding: "6px 22px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <BackBtn />
        <LiveDot />
        <div style={{ width: 38 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 22px 80px" }}>
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: "0.04em" }}>
          {title.toUpperCase()} {time && `· ${time}`}
        </div>

        <div
          style={{
            marginTop: 14,
            padding: "20px 4px",
            borderTop: "1px solid " + C.line,
            borderBottom: "1px solid " + C.line,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
          }}
        >
          <HugeStat n={String(sold)} k="Vendidas" />
          <HugeStat n={String(validated)} k="Validadas" color={C.green} />
          <HugeStat
            n={formatMoney(revenue).replace(/[^\d,.]/g, "").trim() || "0"}
            k="S/ Recaudado"
            small
          />
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600 }}>
            Últimos accesos
          </div>
          <div style={{ fontSize: 11, color: C.dim }}>en vivo</div>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {stats.data?.scansRecent.length ? (
            stats.data.scansRecent.map((s) => (
              <ScanRow
                key={s.id}
                when={new Date(s.scannedAt).toLocaleTimeString("es-PE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                result={s.result}
              />
            ))
          ) : (
            <div
              style={{
                padding: "18px 14px",
                borderRadius: 16,
                background: C.bg2,
                boxShadow: `0 0 0 1px ${C.line} inset`,
                fontSize: 13,
                color: C.dim,
                textAlign: "center",
              }}
            >
              Aún no hay accesos registrados.
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 600 }}>
            Promotores
          </div>
          <div style={{ fontSize: 11, color: C.dim }}>vendido · validado · ingreso</div>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {stats.data?.byPromoter?.length ? (
            stats.data.byPromoter.map((p) => {
              const flagColor =
                p.flag === "suspect" ? C.red : p.flag === "watch" ? C.yellow : C.green;
              const flagLabel =
                p.flag === "suspect"
                  ? "Posible autoventa"
                  : p.flag === "watch"
                    ? "Asistencia baja"
                    : "Asistencia OK";
              const attendancePct = Math.round((p.attendanceRate ?? 0) * 100);
              return (
                <div
                  key={p.promoterLinkId}
                  style={{
                    background: C.bg2,
                    borderRadius: 14,
                    padding: "10px 14px",
                    boxShadow: `0 0 0 1px ${C.line} inset`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontFamily: FONT_DISPLAY,
                        fontWeight: 600,
                        fontSize: 13,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {p.name}
                      <span
                        title={flagLabel}
                        aria-label={flagLabel}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: flagColor,
                          boxShadow: `0 0 6px ${flagColor}66`,
                          display: "inline-block",
                        }}
                      />
                    </span>
                    <span style={{ fontSize: 11, color: C.dim }}>
                      {p.code} · {attendancePct}% asistencia
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10, fontSize: 12, fontWeight: 700 }}>
                    <span>{p.ticketsSold}</span>
                    <span style={{ color: C.green }}>{p.ticketsValidated}</span>
                    <span style={{ color: C.dim }}>
                      {formatMoney(p.revenueCents).replace(/[^\d,.]/g, "").trim() || "0"}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                background: C.bg2,
                boxShadow: `0 0 0 1px ${C.line} inset`,
                fontSize: 12,
                color: C.dim,
                textAlign: "center",
              }}
            >
              Sin ventas por promotor todavía.
            </div>
          )}
        </div>

        <Link
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          href={`/org/events/${slug}/door-link` as any}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div
            style={{
              marginTop: 14,
              padding: "14px 18px",
              background: C.bg2,
              borderRadius: 18,
              boxShadow: `0 0 0 1px ${C.line} inset`,
              fontSize: 13,
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
            }}
          >
            Compartir link de portero →
          </div>
        </Link>

        <button
          type="button"
          onClick={() => {
            window.location.href = `/api/events/${slug}/export`;
          }}
          style={{
            marginTop: 10,
            padding: "14px 18px",
            background: C.bg2,
            borderRadius: 18,
            boxShadow: `0 0 0 1px ${C.line} inset`,
            fontSize: 13,
            fontFamily: FONT_DISPLAY,
            fontWeight: 600,
            color: "inherit",
            textAlign: "left",
            width: "100%",
            border: "none",
            cursor: "pointer",
          }}
        >
          Descargar Excel ↓
        </button>
      </div>
      <LiveBottomNav slug={slug} active="panel" />
    </Phone>
  );
}

const HugeStat = ({
  n,
  k,
  color = "#fff",
  small,
}: {
  n: string;
  k: string;
  color?: string;
  small?: boolean;
}) => (
  <div style={{ textAlign: "center" }}>
    <div
      style={{
        fontFamily: FONT_DISPLAY,
        fontSize: small ? 30 : 40,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        color,
        lineHeight: 1,
      }}
    >
      {n}
    </div>
    <div
      style={{
        fontSize: 11,
        color: C.dim,
        marginTop: 8,
        letterSpacing: "0.05em",
      }}
    >
      {k.toUpperCase()}
    </div>
  </div>
);

const ScanRow = ({
  when,
  result,
}: {
  when: string;
  result: "valid" | "already_used" | "invalid" | "void" | "unknown_event";
}) => {
  const meta = {
    valid: { color: C.green, label: "Válido" },
    already_used: { color: C.yellow, label: "Ya usado" },
    invalid: { color: C.red, label: "Inválido" },
    void: { color: C.red, label: "Anulado" },
    unknown_event: { color: C.dim, label: "Otro evento" },
  }[result];
  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 14,
        padding: "10px 14px",
        boxShadow: `0 0 0 1px ${C.line} inset`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
      <span style={{ fontSize: 11, color: meta.color, fontWeight: 700 }}>{when}</span>
    </div>
  );
};

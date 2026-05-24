"use client";

import { use } from "react";
import { C, FONT_DISPLAY, FONT_MONO, LiveDot, Phone } from "@/components/design";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useEventAccesos } from "@/lib/events/hooks/useEventAccesos";
import { BackBtn, LiveBottomNav } from "../_components";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgLiveAccesosPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const event = useEvent(slug);
  const accesos = useEventAccesos(slug);

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
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "-0.025em",
            marginBottom: 4,
          }}
        >
          Accesos del equipo
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>
          {event.data?.event.title ?? "—"} · en vivo
        </div>

        <div
          style={{
            marginBottom: 14,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: `0 0 0 1px ${C.line} inset`,
            background: C.bg2,
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid " + C.line,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>
              Escaneos recientes
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: C.green,
                padding: "3px 8px",
                borderRadius: 999,
                background: C.greenSoft,
              }}
            >
              {accesos.data?.length ?? 0} TOTAL
            </div>
          </div>

          {accesos.isLoading ? (
            <div style={{ padding: 22, fontSize: 13, color: C.dim, textAlign: "center" }}>
              Cargando…
            </div>
          ) : !accesos.data || accesos.data.length === 0 ? (
            <div style={{ padding: 22, fontSize: 13, color: C.dim, textAlign: "center" }}>
              Aún no hay escaneos.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {accesos.data.map((s, i) => {
                const meta = {
                  valid: { color: C.green, label: "Válido" },
                  already_used: { color: C.yellow, label: "Ya usado" },
                  invalid: { color: C.red, label: "Inválido" },
                  void: { color: C.red, label: "Anulado" },
                  unknown_event: { color: C.dim, label: "Otro evento" },
                }[s.result];
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: i < accesos.data!.length - 1 ? "1px solid " + C.line : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: meta.color,
                          boxShadow: `0 0 8px ${meta.color}`,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13 }}>
                          {meta.label}
                        </div>
                        <div
                          style={{
                            fontFamily: FONT_MONO,
                            fontSize: 10,
                            color: C.dimmer,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {s.ticketId?.slice(0, 8) ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, fontFamily: FONT_MONO }}>
                      {new Date(s.scannedAt).toLocaleTimeString("es-PE", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <LiveBottomNav slug={slug} active="accesos" />
    </Phone>
  );
}

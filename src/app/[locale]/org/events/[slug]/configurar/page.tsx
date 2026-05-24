"use client";

import { use, useState } from "react";
import {
  C,
  FONT_BODY,
  FONT_DISPLAY,
  FONT_MONO,
  LiveDot,
  Phone,
} from "@/components/design";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useUpdateEvent } from "@/lib/events/hooks/useUpdateEvent";
import { formatMoney } from "@/lib/_shared/format";
import { BackBtn, LiveBottomNav } from "../_components";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgLiveConfigPage({ params }: { params: Params }) {
  const { slug } = use(params);
  const event = useEvent(slug);
  const update = useUpdateEvent(slug);
  const [confirming, setConfirming] = useState(false);

  const ev = event.data?.event;
  const tts = event.data?.ticketTypes ?? [];

  const dateLabel = ev
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: ev.timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(ev.startsAt))
    : "—";
  const timeLabel = ev
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: ev.timezone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(ev.startsAt))
    : "—";

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
          Configurar evento
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 22 }}>
          Los cambios se aplican inmediatamente.
        </div>

        {/* Estado */}
        <div
          style={{
            fontSize: 11,
            color: C.dim,
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          ESTADO
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            boxShadow: `0 0 0 1px ${C.line} inset`,
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>
              {ev?.status === "published"
                ? "Publicado"
                : ev?.status === "cancelled"
                  ? "Cancelado"
                  : ev?.status === "closed"
                    ? "Cerrado"
                    : "Borrador"}
            </div>
            <div style={{ fontSize: 11, color: C.dim }}>
              {ev?.status === "published"
                ? "La página está en vivo"
                : ev?.status === "draft"
                  ? "Aún no visible al público"
                  : "—"}
            </div>
          </div>
          {ev?.status === "draft" && (
            <button
              type="button"
              onClick={() => update.mutate({ status: "published" })}
              disabled={update.isPending}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 10,
                border: 0,
                background: C.purple,
                color: "#fff",
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {update.isPending ? "…" : "Publicar"}
            </button>
          )}
        </div>

        {/* Info básica */}
        <div
          style={{
            fontSize: 11,
            color: C.dim,
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          INFORMACIÓN BÁSICA
        </div>
        <ConfigField label="Nombre del evento" value={ev?.title ?? "—"} active />
        <ConfigField label="Fecha" value={dateLabel} mono />
        <ConfigField label="Hora de apertura" value={timeLabel} mono />
        <ConfigField label="Venue" value={ev?.venue ?? "—"} />
        <ConfigField
          label="Aforo máximo"
          value={
            ev?.capacity.totalCapacity != null
              ? `${ev.capacity.totalCapacity} personas`
              : "Sin tope"
          }
          mono
        />

        {/* Transferencias */}
        <div
          style={{
            fontSize: 11,
            color: C.dim,
            letterSpacing: "0.08em",
            marginTop: 18,
            marginBottom: 10,
          }}
        >
          TRANSFERENCIAS
        </div>
        <ToggleRow
          label="Permitir transferir entradas"
          on={!!ev?.transferPolicy.enabled}
          onChange={(v) => update.mutate({ transfersEnabled: v })}
        />
        {ev?.transferPolicy.enabled && (
          <>
            <ConfigField
              label="Cierra horas antes"
              value={
                ev.transferPolicy.deadlineHours != null
                  ? `${ev.transferPolicy.deadlineHours}h`
                  : "Sin límite"
              }
              mono
            />
            <ConfigField
              label="Máximo por entrada"
              value={`${ev.transferPolicy.maxCount}`}
              mono
            />
          </>
        )}

        {/* Entradas */}
        <div
          style={{
            fontSize: 11,
            color: C.dim,
            letterSpacing: "0.08em",
            marginTop: 18,
            marginBottom: 10,
          }}
        >
          TIPOS DE ENTRADA
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tts.length === 0 ? (
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                fontSize: 13,
                color: C.dim,
                textAlign: "center",
              }}
            >
              No hay tipos de entrada todavía.
            </div>
          ) : (
            tts.map((t) => (
              <ConfigTicket
                key={t.id}
                name={t.name}
                price={formatMoney(t.priceCents, t.currency)}
                sold={`${t.sold} de ${t.capacity}`}
              />
            ))
          )}
        </div>

        {/* Zona de peligro */}
        <div
          style={{
            marginTop: 24,
            padding: "14px 16px",
            borderRadius: 14,
            boxShadow: "0 0 0 1px rgba(255,77,94,0.25) inset",
            background: "rgba(255,77,94,0.06)",
          }}
        >
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 14,
              color: C.red,
              marginBottom: 4,
            }}
          >
            Cancelar evento
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.dim,
              lineHeight: 1.5,
              marginBottom: 12,
            }}
          >
            Se notifica a todos los compradores y se inicia el proceso de reembolso.
          </div>
          {ev?.status === "cancelled" ? (
            <div style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>
              Evento cancelado.
            </div>
          ) : confirming ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  border: 0,
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                No, volver
              </button>
              <button
                type="button"
                onClick={() => {
                  update.mutate({ status: "cancelled" });
                  setConfirming(false);
                }}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  border: 0,
                  background: C.red,
                  color: "#fff",
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Sí, cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              style={{
                height: 38,
                padding: "0 16px",
                borderRadius: 10,
                border: 0,
                background: "rgba(255,77,94,0.14)",
                color: C.red,
                fontFamily: FONT_DISPLAY,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancelar y reembolsar →
            </button>
          )}
        </div>

        {update.error && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.red }}>
            {(update.error as Error).message}
          </div>
        )}
      </div>
      <LiveBottomNav slug={slug} active="config" />
    </Phone>
  );
}

const ConfigField = ({
  label,
  value,
  active,
  mono,
}: {
  label: string;
  value: string;
  active?: boolean;
  mono?: boolean;
}) => (
  <div style={{ marginBottom: 10 }}>
    <div
      style={{
        fontSize: 10,
        color: C.dimmer,
        letterSpacing: "0.06em",
        marginBottom: 5,
      }}
    >
      {label.toUpperCase()}
    </div>
    <div
      style={{
        height: 50,
        borderRadius: 13,
        padding: "0 14px",
        background: active ? "rgba(124,58,237,0.10)" : "rgba(255,255,255,0.04)",
        boxShadow: active
          ? `0 0 0 1.5px ${C.purple} inset`
          : "0 0 0 1px rgba(255,255,255,0.07) inset",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: mono ? FONT_MONO : FONT_BODY,
        fontSize: 14,
        color: "#fff",
      }}
    >
      <span>{value}</span>
    </div>
  </div>
);

const ConfigTicket = ({
  name,
  price,
  sold,
}: {
  name: string;
  price: string;
  sold: string;
}) => (
  <div
    style={{
      padding: "11px 14px",
      borderRadius: 14,
      background: "rgba(255,255,255,0.04)",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.07) inset",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <div>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>{name}</div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{sold}</div>
    </div>
    <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14 }}>{price}</div>
  </div>
);

const ToggleRow = ({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    style={{
      width: "100%",
      marginBottom: 10,
      padding: "12px 14px",
      borderRadius: 14,
      background: "rgba(255,255,255,0.04)",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.07) inset",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      border: 0,
      cursor: "pointer",
      color: "#fff",
      fontFamily: FONT_BODY,
      fontSize: 14,
      textAlign: "left",
    }}
  >
    <span>{label}</span>
    <div
      style={{
        width: 36,
        height: 22,
        borderRadius: 999,
        background: on ? C.purple : "rgba(255,255,255,0.12)",
        position: "relative",
        transition: "background 0.15s",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: on ? 16 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </div>
  </button>
);

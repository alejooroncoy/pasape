"use client";

import { use, useState } from "react";
import {
  Btn,
  C,
  CloseBtn,
  FONT_DISPLAY,
  FONT_MONO,
  Field,
  Phone,
  ProfileMenu,
  QrSquare,
  TopBar,
} from "@/components/design";
import Link from "next/link";
import { useTicket, useTransferTicket } from "@/lib/tickets/hooks/useTickets";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";
import { useRotatingQr } from "@/lib/tickets/hooks/useRotatingQr";
import { useBoxForTicket } from "@/lib/boxes/hooks/useBoxes";
import { formatDate } from "@/lib/_shared/format";

type Props = { params: Promise<{ id: string }> };

export default function TicketDetailPage({ params }: Props) {
  const { id } = use(params);
  const me = useCurrentUser();
  const { data, isLoading, error } = useTicket(id);
  const transfer = useTransferTicket();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const rotatingUrl = data && data.status === "active" ? `/api/tickets/${id}/rotating` : null;
  const rotating = useRotatingQr(rotatingUrl);
  // Why: si el ticket tiene box_label, mostramos contador "X de N personas
  // dentro" y, si es host (sin box_host_ticket_id), el botón "Invitar al box".
  const isBoxTicket = !!data?.boxLabel;
  const isHost = isBoxTicket && !data?.boxHostTicketId;
  const boxQuery = useBoxForTicket(isHost ? id : "");
  const box = boxQuery.data ?? null;

  return (
    <Phone>
      <TopBar
        hello="Tu noche"
        title="Tu QR 🎉"
        right={
          <ProfileMenu
            initials={me.data?.user?.fullName?.charAt(0).toUpperCase() ?? "·"}
            color={C.red}
          />
        }
      />

      {isLoading && <div style={{ padding: 28, color: C.dim }}>Cargando…</div>}
      {error && <div style={{ padding: 28, color: C.red }}>{(error as Error).message}</div>}

      {data && (
        <div style={{ padding: "0 22px 120px" }}>
          <div
            style={{
              borderRadius: 28,
              padding: 22,
              background: "linear-gradient(180deg, rgba(124,58,237,0.25), rgba(20,12,40,0.5))",
              boxShadow:
                "0 0 0 1px rgba(124,58,237,0.45) inset, 0 30px 60px -20px rgba(124,58,237,0.55)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "rgba(255,255,255,0.6)" }}>
                MUESTRA EN PUERTA
              </div>
              <div style={{ fontSize: 11, color: C.dim, fontFamily: FONT_MONO }}>
                #{data.id.slice(0, 8).toUpperCase()}
              </div>
            </div>
            {isBoxTicket && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    color: "#fff",
                  }}
                >
                  BOX {data.boxLabel}
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                  {data.holderName ?? me.data?.user?.fullName ?? "Tu pase"}
                </div>
              </div>
            )}
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {data.event.title}
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
              {formatDate(data.event.startsAt, data.event.timezone)} · {data.event.venue ?? ""}
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 20,
                background: "#fff",
                borderRadius: 22,
                display: "flex",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {rotating.payload ? (
                <QrSquare code={rotating.payload} size={220} />
              ) : (
                <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 13 }}>
                  {rotating.error ? "Error generando QR" : "Generando QR…"}
                </div>
              )}
              {rotating.payload && <CountdownRing seconds={rotating.secondsLeft} />}
            </div>

            {isBoxTicket && box && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.85)",
                  textAlign: "center",
                  letterSpacing: "0.02em",
                }}
              >
                {box.members.length} de {box.capacity} personas adentro
              </div>
            )}

            {isHost && data.status === "active" && (
              <Link
                href={`/tickets/${id}/box`}
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 16px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: "0.02em",
                  textDecoration: "none",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.12) inset",
                }}
              >
                INVITAR AL BOX
                <span aria-hidden style={{ opacity: 0.7 }}>→</span>
              </Link>
            )}

            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.06em", color: C.dim }}>
                  {(data.holderName ?? me.data?.user?.fullName ?? "TITULAR").toUpperCase()}
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600 }}>{data.ticketType.name}</div>
              </div>
              {data.status === "active" && (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: 0,
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Transferir →
                </button>
              )}
              {data.status === "used" && (
                <div
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "rgba(255,77,94,0.18)",
                    color: C.red,
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: "0.08em",
                  }}
                >
                  YA USADA
                </div>
              )}
            </div>
          </div>

          {data.status === "active" && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: 14,
                background: "rgba(124,58,237,0.18)",
                boxShadow: "0 0 0 1px rgba(124,58,237,0.45) inset",
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 13,
              }}
            >
              <ShieldIcon />
              <div style={{ lineHeight: 1.35 }}>
                <div style={{ fontWeight: 600 }}>Tu QR cambia cada 10 segundos</div>
                <div style={{ fontSize: 11, color: C.dim }}>
                  Las capturas no sirven · necesitas esta web abierta
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 390,
              background: C.bg2,
              borderRadius: "22px 22px 0 0",
              padding: "22px 22px 36px",
              boxShadow: "0 -1px 0 rgba(255,255,255,0.07) inset",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.14)" }} />
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
              Transferir entrada
            </div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 18, lineHeight: 1.5 }}>
              La entrada deja de ser tuya. El receptor recibe su QR.
            </div>
            <Field
              label="Email o celular del receptor"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              active={recipient.length > 0}
            />
            <Btn
              onClick={async () => {
                if (!data) return;
                await transfer.mutateAsync({ ticketId: data.id, toIdentifier: recipient });
                setOpen(false);
                setRecipient("");
              }}
              disabled={transfer.isPending || !recipient}
            >
              {transfer.isPending ? "Transfiriendo…" : "Confirmar transferencia"}
            </Btn>
            {transfer.error && (
              <div style={{ marginTop: 10, fontSize: 12, color: C.red, textAlign: "center" }}>
                {transferErrorCopy((transfer.error as Error).message)}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 390,
          padding: "12px 22px 16px",
          background: `linear-gradient(180deg, transparent, ${C.bg} 30%)`,
        }}
      >
        <CloseBtn href="/tickets" />
      </div>
    </Phone>
  );
}

const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path
      d="M11 2L3 5v5c0 4.5 3.2 8.5 8 10 4.8-1.5 8-5.5 8-10V5l-8-3Z"
      fill="rgba(124,58,237,0.18)"
      stroke="#7C3AED"
      strokeWidth="1.4"
    />
    <path
      d="M7.5 11l2.5 2.5L14.5 9"
      stroke="#7C3AED"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Ring sincronizado con el window real del rotating QR (useRotatingQr).
const CountdownRing = ({ seconds }: { seconds: number }) => {
  const r = 20;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, (10 - seconds) / 10));
  const offset = circumference * progress;
  return (
    <div
      style={{
        position: "absolute",
        top: -10,
        right: -10,
        width: 48,
        height: 48,
        borderRadius: 999,
        background: C.bg,
        boxShadow: `0 0 0 2px ${C.bg2}, 0 8px 20px rgba(0,0,0,0.4)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
      >
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={C.purple}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${C.purple})`, transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 14,
          color: C.purple,
          letterSpacing: "-0.02em",
        }}
      >
        {seconds}s
      </div>
    </div>
  );
};

const transferErrorCopy = (raw: string): string => {
  switch (raw) {
    case "transfer_window_closed":
      return "Ya no se puede transferir — la ventana cerró cerca del evento.";
    case "transfers_disabled":
      return "Este evento no permite transferencias.";
    case "transfer_limit_reached":
      return "Este ticket ya alcanzó el máximo de transferencias.";
    case "not_owner":
      return "No sos el dueño actual de este ticket.";
    case "ticket_not_active":
      return "Este ticket ya no está activo (usado o anulado).";
    case "recipient_required":
      return "Necesitamos a quién transferir.";
    default:
      return raw;
  }
};

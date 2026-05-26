"use client";

import type { ReactNode } from "react";
import { C, FONT_DISPLAY } from "./tokens";
import { Arrow } from "./Atoms";
import { QrSquare } from "./QrSquare";

type TabProps = { label: string; count: number; on?: boolean; onClick?: () => void };

export const TicketTab = ({ label, count, on, onClick }: TabProps) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: 1,
      padding: "10px 12px",
      borderRadius: 10,
      textAlign: "center",
      background: on ? "#fff" : "transparent",
      color: on ? "#0A0A0F" : C.dim,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      border: 0,
      cursor: "pointer",
    }}
  >
    <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
    <span
      style={{
        fontSize: 10,
        padding: "1px 6px",
        borderRadius: 999,
        background: on ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)",
        color: on ? "#0A0A0F" : C.dim,
        fontWeight: 700,
      }}
    >
      {count}
    </span>
  </button>
);

type LgProps = {
  title: string;
  venue: string;
  type: string;
  countdown?: string;
  qrCode: string;
  color1?: string;
  color2?: string;
  live?: boolean;
  onView?: () => void;
};

export const TicketCardLg = ({
  title,
  venue,
  type,
  countdown,
  qrCode,
  color1 = C.purple,
  color2 = C.red,
  live,
  onView,
}: LgProps) => (
  <div
    style={{
      borderRadius: 22,
      overflow: "hidden",
      position: "relative",
      boxShadow: `0 0 0 1px ${C.line} inset, 0 20px 40px -10px rgba(0,0,0,0.4)`,
    }}
  >
    <div
      style={{
        height: 110,
        background: `linear-gradient(135deg, ${color1}, ${color2})`,
        position: "relative",
        padding: 16,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(60% 50% at 30% 30%, rgba(255,255,255,0.25), transparent 60%)",
        }}
      />
      {live && countdown && (
        <div
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(8px)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#fff",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: C.green,
              boxShadow: `0 0 8px ${C.green}`,
              animation: "pulse 1.4s ease-in-out infinite",
            }}
          />
          HOY · {countdown}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 16,
          right: 16,
          fontFamily: FONT_DISPLAY,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          lineHeight: 1,
          color: "#fff",
        }}
      >
        {title}
      </div>
    </div>

    <div
      style={{
        position: "relative",
        height: 16,
        background: C.bg2,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ width: 16, height: 16, borderRadius: 999, background: C.bg, marginLeft: -8 }} />
      <div style={{ flex: 1, margin: "0 4px", borderTop: "1.5px dashed rgba(255,255,255,0.15)" }} />
      <div style={{ width: 16, height: 16, borderRadius: 999, background: C.bg, marginRight: -8 }} />
    </div>

    <div style={{ padding: "14px 16px 16px", background: C.bg2 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: "0.04em" }}>
            {venue.toUpperCase()}
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, marginTop: 2 }}>
            {type}
          </div>
        </div>
        <div style={{ width: 52, height: 52, background: "#fff", borderRadius: 10, padding: 4 }}>
          <QrSquare code={qrCode} size={44} />
        </div>
      </div>
      <button
        type="button"
        onClick={onView}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 12,
          border: 0,
          background: C.purple,
          color: "#fff",
          fontFamily: FONT_DISPLAY,
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 12px 24px -8px rgba(124,58,237,0.5)",
          cursor: "pointer",
        }}
      >
        Ver mi QR →
      </button>
    </div>
  </div>
);

type SmProps = {
  title: string;
  when: string;
  type: string;
  color1?: string;
  color2?: string;
  isBox?: boolean;
  trailing?: ReactNode;
  onClick?: () => void;
};

export const TicketCardSm = ({
  title,
  when,
  type,
  color1 = C.purple,
  color2 = C.red,
  isBox,
  trailing,
  onClick,
}: SmProps) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      marginBottom: 8,
      background: C.bg2,
      borderRadius: 16,
      boxShadow: `0 0 0 1px ${C.line} inset`,
      border: 0,
      cursor: "pointer",
      textAlign: "left",
    }}
  >
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: 12,
        flexShrink: 0,
        background: `linear-gradient(135deg, ${color1}, ${color2})`,
        position: "relative",
      }}
    >
      {isBox && (
        <div
          style={{
            position: "absolute",
            bottom: -4,
            right: -4,
            fontSize: 8,
            padding: "2px 6px",
            borderRadius: 999,
            background: C.yellow,
            color: "#1a1200",
            fontWeight: 700,
            letterSpacing: "0.04em",
            boxShadow: `0 0 0 2px ${C.bg2}`,
          }}
        >
          BOX
        </div>
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: "#fff" }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{when}</div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{type}</div>
    </div>
    {trailing ?? <Arrow />}
  </button>
);

export const FannedTicketsHero = () => (
  <div
    style={{
      flex: 1,
      position: "relative",
      borderRadius: 24,
      background:
        "radial-gradient(120% 80% at 50% 0%, rgba(124,58,237,0.16), transparent 70%), " + C.bg2,
      boxShadow: `0 0 0 1px ${C.line} inset`,
      overflow: "hidden",
      minHeight: 360,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 60,
        left: "50%",
        transform: "translateX(-50%) rotate(-4deg)",
        width: 220,
        height: 130,
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(255,77,94,0.1))",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 80,
        left: "50%",
        transform: "translateX(-50%) rotate(3deg)",
        width: 220,
        height: 130,
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(255,206,59,0.12), rgba(124,58,237,0.08))",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 100,
        left: "50%",
        transform: "translateX(-50%)",
        width: 220,
        height: 130,
        borderRadius: 16,
        background: "linear-gradient(135deg, #4B1F9A, #7C3AED)",
        boxShadow:
          "0 20px 40px -10px rgba(124,58,237,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset",
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.7)",
          fontWeight: 600,
        }}
      >
        TU PRIMERA ENTRADA
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          marginTop: 28,
          lineHeight: 1,
          color: "#fff",
        }}
      >
        Aquí.
      </div>
    </div>

    <div
      style={{
        position: "absolute",
        bottom: 26,
        left: 22,
        right: 22,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          color: "#fff",
        }}
      >
        Aún no tienes entradas.
      </div>
      <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>Explora eventos esta noche.</div>
    </div>
  </div>
);

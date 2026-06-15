"use client";

import { Money } from "@/lib/_shared/money";
import { C, FONT_DISPLAY } from "./tokens";

type Props = {
  name: string;
  sub: string;
  priceCents: number;
  qty: number;
  onChange: (next: number) => void;
  remaining: number;
  accent?: string | null;
  disabled?: boolean;
};

const fmt = (cents: number) => Money.format(cents);

export const BuyTicketRow = ({ name, sub, priceCents, qty, onChange, remaining, accent, disabled }: Props) => {
  const tone = accent ?? C.purple;
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 16,
        background: qty > 0 ? `${tone}15` : "rgba(255,255,255,0.03)",
        boxShadow:
          qty > 0
            ? `0 0 0 1.5px ${tone} inset`
            : `0 0 0 1px ${C.line} inset`,
        opacity: disabled ? 0.45 : 1,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{name}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: C.dim }}>{fmt(priceCents)}</div>
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{sub}</div>
      </div>
      {!disabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Step direction="-" disabled={qty === 0} onClick={() => onChange(Math.max(0, qty - 1))} />
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, minWidth: 14, textAlign: "center" }}>{qty}</span>
          <Step direction="+" disabled={qty >= remaining} onClick={() => onChange(qty + 1)} />
        </div>
      )}
    </div>
  );
};

const Step = ({ direction, onClick, disabled }: { direction: "+" | "-"; onClick: () => void; disabled: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    style={{
      width: 28,
      height: 28,
      borderRadius: 999,
      background: "rgba(255,255,255,0.08)",
      color: "#fff",
      border: 0,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.4 : 1,
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 16,
      lineHeight: 1,
    }}
  >
    {direction}
  </button>
);

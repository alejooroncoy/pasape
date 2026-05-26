import { C, FONT_BODY, FONT_MONO } from "./tokens";

type Props = { label: string; value: string; mono?: boolean };

export const ReadonlyField = ({ label, value, mono }: Props) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 11, color: C.dimmer, letterSpacing: "0.06em", marginBottom: 5 }}>{label.toUpperCase()}</div>
    <div
      style={{
        height: 48,
        borderRadius: 13,
        padding: "0 14px",
        background: "rgba(255,255,255,0.03)",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.07) inset",
        display: "flex",
        alignItems: "center",
        fontFamily: mono ? FONT_MONO : FONT_BODY,
        fontSize: 14,
        color: "rgba(255,255,255,0.75)",
      }}
    >
      {value}
    </div>
  </div>
);

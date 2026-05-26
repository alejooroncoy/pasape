import { C, FONT_DISPLAY } from "./tokens";

type Props = {
  title: string;
  venue: string;
  price: string;
  color1?: string;
  color2?: string;
};

export const EventRow = ({ title, venue, price, color1 = C.purple, color2 = C.red }: Props) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 12px",
      marginBottom: 8,
      background: C.bg2,
      borderRadius: 16,
      boxShadow: `0 0 0 1px ${C.line} inset`,
    }}
  >
    <div style={{ width: 52, height: 52, borderRadius: 12, background: `linear-gradient(135deg, ${color1}, ${color2})`, flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.dim }}>{venue}</div>
    </div>
    <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>{price}</div>
  </div>
);

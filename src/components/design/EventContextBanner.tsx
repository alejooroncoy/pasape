import { C, FONT_DISPLAY } from "./tokens";

type Props = {
  title: string;
  detail: string;
  saved?: boolean;
};

export const EventContextBanner = ({ title, detail, saved }: Props) => (
  <div
    style={{
      padding: "10px 14px",
      background: "rgba(255,255,255,0.04)",
      boxShadow: `0 0 0 1px ${C.line} inset`,
      borderRadius: 14,
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}
  >
    <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #4B1F9A, #7C3AED)", flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 11, color: C.dim }}>{detail}</div>
    </div>
    {saved && (
      <div
        style={{
          fontSize: 11,
          color: C.dim,
          background: "rgba(255,255,255,0.06)",
          padding: "4px 8px",
          borderRadius: 999,
          flexShrink: 0,
        }}
      >
        guardado
      </div>
    )}
  </div>
);

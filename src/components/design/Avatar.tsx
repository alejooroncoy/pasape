import { C, FONT_DISPLAY } from "./tokens";

type Props = { initials?: string; color?: string };

export const Avatar = ({ initials = "·", color = C.purple }: Props) => (
  <div
    style={{
      width: 38,
      height: 38,
      borderRadius: 14,
      background: color,
      color: "#fff",
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 14,
      boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
    }}
  >
    {initials}
  </div>
);

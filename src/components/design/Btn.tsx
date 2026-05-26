import type { ButtonHTMLAttributes, ReactNode } from "react";
import { C, FONT_DISPLAY } from "./tokens";

type Kind = "primary" | "secondary" | "green" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: Kind;
  icon?: ReactNode;
};

const styles: Record<Kind, React.CSSProperties> = {
  primary: {
    background: C.purple,
    color: "#fff",
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.06) inset, 0 12px 28px -8px rgba(124,58,237,0.6), 0 0 36px -4px rgba(124,58,237,0.45)",
  },
  secondary: {
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.1) inset",
  },
  green: {
    background: C.green,
    color: "#062315",
    boxShadow: "0 12px 28px -8px rgba(34,209,127,0.5)",
  },
  ghost: {
    background: "transparent",
    color: C.dim,
    boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
  },
};

export const Btn = ({ children, kind = "primary", icon, style, ...p }: Props) => (
  <button
    type="button"
    style={{
      height: 60,
      borderRadius: 18,
      border: 0,
      padding: "0 20px",
      fontFamily: FONT_DISPLAY,
      fontSize: 16,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      cursor: "pointer",
      width: "100%",
      ...styles[kind],
      ...style,
    }}
    {...p}
  >
    {icon}
    {children}
  </button>
);

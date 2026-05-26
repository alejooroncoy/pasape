import type { ButtonHTMLAttributes } from "react";
import { FONT_DISPLAY } from "./tokens";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { label?: string };

export const GoogleBtn = ({ label = "Continuar con Google", ...p }: Props) => (
  <button
    type="button"
    style={{
      height: 60,
      borderRadius: 18,
      border: 0,
      padding: "0 20px",
      background: "#fff",
      color: "#1a1a1a",
      fontFamily: FONT_DISPLAY,
      fontSize: 16,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      cursor: "pointer",
      width: "100%",
      boxShadow: "0 2px 12px rgba(0,0,0,0.35)",
    }}
    {...p}
  >
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 3-4.32 3-7.31z" fill="#4285F4" />
      <path d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.58-4.11H1.06v2.58A10 10 0 0 0 10 20z" fill="#34A853" />
      <path d="M4.42 11.93A5.98 5.98 0 0 1 4.1 10c0-.67.12-1.32.32-1.93V5.49H1.06A10 10 0 0 0 0 10c0 1.61.39 3.14 1.06 4.51l3.36-2.58z" fill="#FBBC05" />
      <path d="M10 3.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87C14.95.99 12.7 0 10 0A10 10 0 0 0 1.06 5.49l3.36 2.58C5.2 5.71 7.4 3.96 10 3.96z" fill="#EA4335" />
    </svg>
    {label}
  </button>
);

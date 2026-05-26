import { C } from "./tokens";

type Props = { label: string; on?: boolean; onClick?: () => void };

export const FilterChip = ({ label, on, onClick }: Props) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flexShrink: 0,
      padding: "8px 14px",
      borderRadius: 999,
      background: on ? "#fff" : "rgba(255,255,255,0.06)",
      color: on ? "#0A0A0F" : C.dim,
      fontSize: 12,
      fontWeight: 600,
      boxShadow: on ? "none" : `0 0 0 1px ${C.line} inset`,
      border: 0,
      cursor: "pointer",
    }}
  >
    {label}
  </button>
);

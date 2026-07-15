"use client";

import { useRouter } from "@/i18n/navigation";
import { C } from "./tokens";

const buttonStyle = {
  width: 38,
  height: 38,
  borderRadius: 14,
  background: C.line,
  boxShadow: `0 0 0 1px ${C.line} inset`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  border: 0,
  color: C.text,
} as const;

export const CloseBtn = ({ href = "/" as string }) => {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Cerrar"
      style={buttonStyle}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onClick={() => router.push(href as any)}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 3l8 8M11 3l-8 8" stroke={C.text} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
};

"use client";

import { useRouter } from "@/i18n/navigation";

const buttonStyle = {
  width: 38,
  height: 38,
  borderRadius: 14,
  background: "rgba(255,255,255,0.06)",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  border: 0,
  color: "#fff",
} as const;

export const BackBtn = () => {
  const router = useRouter();
  return (
    <button type="button" aria-label="Volver" style={buttonStyle} onClick={() => router.back()}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 3l-5 5 5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
};

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
        <path d="M3 3l8 8M11 3l-8 8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
};

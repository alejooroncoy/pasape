"use client";

import { useRef } from "react";
import { C, FONT_MONO } from "./tokens";

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export const OtpRow = ({ value, onChange }: Props) => {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const setAt = (idx: number, char: string) => {
    const safe = char.replace(/\D/g, "").slice(0, 1);
    const next = (value + "      ").slice(0, 6).split("");
    next[idx] = safe || " ";
    const joined = next.join("").trimEnd();
    onChange(joined);
    if (safe && idx < 5) inputs.current[idx + 1]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const ch = value[i] ?? "";
        const filled = ch !== "" && ch !== " ";
        const isFocus = i === value.length;
        return (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={ch.trim()}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !ch && i > 0) inputs.current[i - 1]?.focus();
            }}
            inputMode="numeric"
            maxLength={1}
            style={{
              width: 46,
              height: 58,
              borderRadius: 14,
              background: filled ? "rgba(124,58,237,0.14)" : "var(--color-cart-line-2)",
              boxShadow: isFocus
                ? `0 0 0 1.5px ${C.purple} inset, 0 0 18px -6px rgba(124,58,237,0.5)`
                : filled
                  ? "0 0 0 1px rgba(124,58,237,0.4) inset"
                  : `0 0 0 1px ${C.line} inset`,
              fontFamily: FONT_MONO,
              fontWeight: 700,
              fontSize: 24,
              color: C.text,
              textAlign: "center",
              border: 0,
              outline: "none",
              transition: "all .15s",
            }}
          />
        );
      })}
    </div>
  );
};

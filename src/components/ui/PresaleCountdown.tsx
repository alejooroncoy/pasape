"use client";

import { useEffect, useState } from "react";

/**
 * Countdown de preventa/liberación. La visibilidad la decide el backend
 * (`showCountdown` + `countdownEndsAt`); acá solo animamos el display.
 */
export function PresaleCountdown({
  endsAt,
  className,
}: {
  endsAt: string; // ISO
  className?: string;
}) {
  const target = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, target - now);
  if (left <= 0) return null;
  const h = Math.floor(left / 3600_000);
  const m = Math.floor((left % 3600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  const urgent = left < 3600_000;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 text-[11.5px] font-semibold " +
        (urgent ? "text-rose-400" : "text-amber-400") +
        (className ? " " + className : "")
      }
    >
      <span className={"size-1.5 animate-pulse rounded-full " + (urgent ? "bg-rose-400" : "bg-amber-400")} />
      Preventa termina en {h > 0 ? `${h}h ` : ""}
      {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
    </span>
  );
}

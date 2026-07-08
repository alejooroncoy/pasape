"use client";

import { Link } from "@/i18n/navigation";

/** Enlace secundario a recuperación de entradas — M39. */
export function RecoverTicketsLink({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={"/recover-tickets" as never}
      className={
        className ||
        "text-[13px] font-medium text-cart-ink-3 underline-offset-2 transition hover:text-white hover:underline"
      }
    >
      {compact ? "¿Compraste y no ves tu QR?" : "¿Compraste y no ves tu QR? Recuperar mis entradas"}
    </Link>
  );
}

"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type Props = {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  danger?: boolean;
};

/**
 * Sección estilo iOS Settings / Cursor: header con título + descripción,
 * lista de filas separadas por hairlines, padding generoso. Sin sub-card
 * inflado, sólo aire.
 */
export function SettingsCard({ id, title, description, children, action, danger }: Props) {
  return (
    <motion.section
      id={id}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
      }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={`scroll-mt-24 overflow-hidden rounded-2xl border ${
        danger ? "border-rose-500/20 bg-rose-500/5" : "border-cart-line bg-cart-bg-elev"
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6 pb-5 sm:px-8 sm:pt-7">
        <div>
          <h2
            className={`text-[16px] font-semibold tracking-[-0.01em] ${
              danger ? "text-rose-300" : "text-white"
            }`}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-prose text-[13px] leading-snug text-cart-ink-3">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </header>
      <div className="divide-y divide-cart-line border-t border-cart-line">{children}</div>
    </motion.section>
  );
}

/**
 * Fila iOS Settings / Cursor: label + descripción a la izquierda, control a la
 * derecha (stack en mobile). Padding generoso para que respire.
 */
export function SettingsRow({
  label,
  description,
  children,
  align = "center",
}: {
  label?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`flex flex-col gap-3 px-6 py-5 sm:flex-row sm:gap-6 sm:px-8 ${
        align === "start" ? "sm:items-start" : "sm:items-center"
      }`}
    >
      {(label || description) && (
        <div className="min-w-0 flex-1">
          {label ? (
            <div className="text-[14px] font-medium text-white">{label}</div>
          ) : null}
          {description ? (
            <div className="mt-1 max-w-prose text-[12.5px] leading-snug text-cart-ink-3">
              {description}
            </div>
          ) : null}
        </div>
      )}
      {children ? <div className="w-full sm:w-[280px] sm:flex-shrink-0">{children}</div> : null}
    </div>
  );
}

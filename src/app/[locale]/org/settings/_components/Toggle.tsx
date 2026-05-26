"use client";

import { motion } from "motion/react";

type Props = {
  label?: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /**
   * When true, render as a bare row (no border / background) — meant for grouped iOS lists.
   */
  bare?: boolean;
};

/** Switch primitive sin label/descripción — para usar dentro de SettingsRow. */
export function Switch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-[30px] w-[50px] flex-shrink-0 items-center rounded-full transition-colors"
      style={{
        backgroundColor: checked ? "#7C3AED" : "rgba(255,255,255,0.10)",
        boxShadow: checked
          ? "0 0 14px var(--color-cart-accent-glow), inset 0 0 0 1px rgba(255,255,255,0.06)"
          : "inset 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      <motion.span
        aria-hidden
        animate={{ x: checked ? 23 : 3 }}
        transition={{ type: "spring", stiffness: 520, damping: 32 }}
        className="absolute left-0 top-1/2 block size-[24px] -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
      />
    </button>
  );
}

export function Toggle({ label, description, checked, onChange, bare }: Props) {
  if (!label) {
    return <Switch checked={checked} onChange={onChange} />;
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={
        bare
          ? "flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.015] sm:px-6"
          : "flex w-full items-center justify-between gap-4 rounded-xl border border-cart-line bg-cart-bg-elev-2 px-4 py-3.5 text-left transition-colors hover:border-cart-line-strong"
      }
    >
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-white">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-cart-ink-3">
            {description}
          </span>
        ) : null}
      </span>
      <motion.span
        className="relative inline-flex h-[30px] w-[50px] flex-shrink-0 items-center rounded-full transition-colors"
        animate={{ backgroundColor: checked ? "#7C3AED" : "rgba(255,255,255,0.10)" }}
        transition={{ duration: 0.18 }}
        style={{
          boxShadow: checked
            ? "0 0 14px var(--color-cart-accent-glow), inset 0 0 0 1px rgba(255,255,255,0.06)"
            : "inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <motion.span
          aria-hidden
          animate={{ x: checked ? 23 : 3 }}
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
          className="absolute left-0 top-1/2 block size-[24px] -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
        />
      </motion.span>
    </button>
  );
}

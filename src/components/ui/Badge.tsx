import { tv, type VariantProps } from "tailwind-variants";
import type { HTMLAttributes } from "react";

// Colores de success/warning/danger (border+bg suave, opacidad /30-/10) son
// los que ya venían probados en producción vía eventStatusDisplay.ts (pills
// de evento en EventCard/OrgHomeClient/reports) — se promovieron acá para
// que ESTE sea el único lugar que define un pill con tono en todo el repo.
const badgeStyles = tv({
  base: "inline-flex items-center gap-1 rounded-full border font-medium",
  variants: {
    tone: {
      neutral: "border-(--color-border) bg-(--color-bg-card) text-(--color-fg-muted)",
      accent: "border-transparent bg-(--color-accent-soft) text-(--color-accent)",
      success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
      danger: "border-rose-400/30 bg-rose-500/10 text-rose-300",
      warning: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    },
    size: {
      md: "px-2.5 py-1 text-xs",
      sm: "px-2 py-0.5 text-[10.5px]",
    },
  },
  defaultVariants: { tone: "neutral", size: "md" },
});

export const Badge = ({
  tone,
  size,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>) => (
  <span className={badgeStyles({ tone, size, className })} {...props} />
);

import { tv, type VariantProps } from "tailwind-variants";
import type { HTMLAttributes } from "react";

const badgeStyles = tv({
  base: "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
  variants: {
    tone: {
      neutral: "bg-(--color-bg-card) text-(--color-fg-muted) border border-(--color-border)",
      accent: "bg-(--color-accent-soft) text-(--color-accent)",
      success: "bg-emerald-500/15 text-emerald-300",
      danger: "bg-rose-500/15 text-rose-300",
      warning: "bg-amber-500/15 text-amber-300",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export const Badge = ({
  tone,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeStyles>) => (
  <span className={badgeStyles({ tone, className })} {...props} />
);

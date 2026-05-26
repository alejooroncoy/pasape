import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/_shared/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-2xl border border-(--color-border) bg-(--color-bg-card) px-4 text-base text-(--color-fg) placeholder:text-(--color-fg-subtle) focus:outline-none focus:border-(--color-accent)",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

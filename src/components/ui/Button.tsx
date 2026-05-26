import { Slot } from "@radix-ui/react-slot";
import { tv, type VariantProps } from "tailwind-variants";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export const buttonStyles = tv({
  base: "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) disabled:opacity-50 disabled:pointer-events-none",
  variants: {
    variant: {
      primary: "bg-(--color-accent) text-white hover:opacity-90",
      secondary: "bg-(--color-bg-card) text-(--color-fg) border border-(--color-border) hover:bg-(--color-bg-elevated)",
      ghost: "text-(--color-fg) hover:bg-(--color-bg-card)",
      danger: "bg-(--color-danger) text-white hover:opacity-90",
    },
    size: {
      sm: "h-9 px-4 text-sm",
      md: "h-11 px-5 text-sm",
      lg: "h-14 px-6 text-base",
      icon: "h-10 w-10 rounded-full p-0",
    },
    block: { true: "w-full", false: "" },
  },
  defaultVariants: { variant: "primary", size: "md", block: false },
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & { asChild?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild, variant, size, block, className, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={buttonStyles({ variant, size, block, className })}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  withDot?: boolean;
  className?: string;
};

export function Eyebrow({ children, withDot = false, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 rounded-full border border-cart-line px-3.5 py-1.5 text-[13px] font-medium text-cart-ink-3 ${
        withDot ? "pl-2.5" : ""
      } ${className}`.trim()}
    >
      {withDot ? (
        <span
          aria-hidden="true"
          className="size-[7px] rounded-full bg-cart-accent animate-pulse-dot"
        />
      ) : null}
      {children}
    </span>
  );
}

import type { ReactNode } from "react";

type Variant = "primary" | "ghost" | "ghost-dark";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-cart-accent text-white font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_10px_28px_-10px_var(--color-cart-accent-glow-strong)] hover:-translate-y-px hover:brightness-105",
  ghost:
    "text-cart-ink-2 font-medium border border-cart-line hover:text-cart-ink hover:border-cart-line-strong",
  "ghost-dark":
    "text-cart-ink-3 font-medium bg-transparent border-0 hover:text-cart-accent",
};

type CommonProps = {
  children: ReactNode;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  variant?: Variant;
  className?: string;
  "aria-label"?: string;
};

type ButtonAsLink = CommonProps & {
  href: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  type?: never;
};

type ButtonAsButton = CommonProps & {
  href?: never;
  target?: never;
  rel?: never;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
};

export function Button(props: ButtonAsLink | ButtonAsButton) {
  const {
    children,
    leadingIcon,
    trailingIcon,
    variant = "primary",
    className = "",
  } = props;

  const base =
    variant === "ghost-dark"
      ? "inline-flex items-center gap-2 px-1 py-2.5 text-sm transition-colors"
      : "inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full text-base transition-[transform,box-shadow,filter] duration-150 ease-out";

  const cls = `${base} ${VARIANTS[variant]} ${className}`.trim();

  if ("href" in props && props.href) {
    return (
      <a
        href={props.href}
        target={props.target}
        rel={props.rel ?? "noopener noreferrer"}
        aria-label={props["aria-label"]}
        onClick={props.onClick}
        className={cls}
      >
        {leadingIcon}
        <span>{children}</span>
        {trailingIcon}
      </a>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      aria-label={props["aria-label"]}
      className={cls}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  );
}

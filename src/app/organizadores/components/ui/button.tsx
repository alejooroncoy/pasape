import type { ReactNode } from "react";

type Variant = "primary" | "ghost" | "ghost-dark";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white font-medium shadow-cta hover:-translate-y-px hover:shadow-glow-strong",
  ghost:
    "text-ink-2 font-medium border border-line hover:text-ink hover:border-line-strong",
  "ghost-dark":
    "text-ink-3 font-medium bg-transparent border-0 hover:text-accent",
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

import type { ReactNode } from "react";

type Props = {
  tag: string;
  title: string;
  payoff: string;
  icon?: ReactNode;
  visual?: ReactNode;
  className?: string;
  accent?: boolean;
  wide?: boolean;
  href?: string;
};

export function FeatureCard({
  tag,
  title,
  payoff,
  icon,
  visual,
  className = "",
  accent = false,
  wide = false,
  href = "#form",
}: Props) {
  return (
    <article
      className={`feature-card reveal group relative flex min-h-0 flex-col gap-5 overflow-hidden rounded-[20px] border p-5 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 md:min-h-[280px] md:p-6 ${
        accent
          ? "border-cart-accent/30 bg-cart-accent-soft hover:border-cart-accent/50"
          : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong"
      } ${wide ? "md:min-h-[300px]" : ""} ${className}`.trim()}
    >
      {visual ? (
        <div
          className={`feature-card-visual relative z-[1] rounded-2xl border border-cart-line bg-cart-bg/60 p-4 ${
            wide ? "md:p-5" : ""
          }`}
        >
          {visual}
        </div>
      ) : null}

      <div className="relative z-[1] mt-auto flex flex-1 flex-col justify-end gap-2.5">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-cart-accent-soft text-cart-accent transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
              {icon}
            </span>
          ) : null}
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-cart-accent">
            {tag}
          </span>
        </div>

        <h3
          className={`m-0 text-balance font-sans font-semibold leading-snug tracking-[-0.018em] text-cart-ink ${
            wide ? "md:max-w-[32ch] text-[clamp(20px,4.5vw,26px)]" : "text-[clamp(18px,4vw,21px)] md:max-w-[24ch]"
          }`}
        >
          {title}
        </h3>

        <p className="m-0 max-w-[42ch] text-pretty text-[14px] leading-relaxed text-cart-ink-2">
          {payoff}
        </p>

        <a
          href={href}
          className="group/link mt-1 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-cart-accent transition-colors hover:text-cart-accent/80"
        >
          Saber más
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden
            className="transition-transform duration-200 ease-out group-hover/link:translate-x-1"
          >
            <path
              d="M3 7h8M7 3l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </article>
  );
}

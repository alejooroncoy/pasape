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
}: Props) {
  return (
    <article
      className={`feature-card reveal group relative flex min-h-0 flex-col rounded-[18px] border p-5 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 md:min-h-[220px] md:rounded-[20px] md:p-6 ${
        accent
          ? "border-cart-accent/30 bg-cart-accent-soft hover:border-cart-accent/50"
          : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong"
      } ${wide ? "md:min-h-[240px] md:p-8" : ""} ${className}`.trim()}
    >
      <div
        className={`relative z-[1] flex flex-1 flex-col gap-4 ${wide ? "md:grid md:grid-cols-[1fr_minmax(220px,280px)] md:items-end md:gap-8" : ""}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-cart-accent">
              {tag}
            </span>
            {icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-cart-accent-soft text-cart-accent">
                {icon}
              </span>
            ) : null}
          </div>

          <h3
            className={`m-0 text-balance font-sans font-semibold leading-snug tracking-[-0.018em] text-cart-ink ${wide ? "md:max-w-[28ch] text-[clamp(20px,5vw,30px)]" : "text-[clamp(18px,4.5vw,24px)] md:max-w-[22ch]"}`}
          >
            {title}
          </h3>

          {wide ? (
            <div className="mt-auto rounded-xl border border-cart-accent/25 bg-cart-bg/60 px-3.5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-cart-accent md:max-w-[36ch]">
              ✓ {payoff}
            </div>
          ) : null}
        </div>

        {visual ? <div className={wide ? "md:self-stretch" : "mt-auto"}>{visual}</div> : null}

        {!wide ? (
          <div className="mt-auto rounded-xl border border-cart-accent/25 bg-cart-bg/60 px-3.5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-cart-accent">
            ✓ {payoff}
          </div>
        ) : null}
      </div>
    </article>
  );
}

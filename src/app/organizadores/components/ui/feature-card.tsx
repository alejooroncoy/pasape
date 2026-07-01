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
      className={`feature-card reveal group relative flex min-h-[220px] flex-col overflow-hidden rounded-[20px] border p-6 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 ${
        accent
          ? "border-accent/35 bg-[linear-gradient(160deg,rgba(36,8,70,0.9)_0%,rgba(18,18,26,0.98)_55%)] shadow-[0_16px_40px_-18px_var(--color-accent-glow)] hover:border-accent/55 hover:shadow-[0_24px_50px_-16px_var(--color-accent-glow)]"
          : "border-line-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0)),var(--color-bg-elev)] hover:border-accent/40 hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)]"
      } ${wide ? "md:min-h-[240px] md:p-8" : ""} ${className}`.trim()}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-accent/10 blur-2xl" />
      </div>

      <div
        className={`relative z-[1] flex flex-1 flex-col gap-4 ${wide ? "md:grid md:grid-cols-[1fr_minmax(220px,280px)] md:items-end md:gap-8" : ""}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              {tag}
            </span>
            {icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line-strong bg-bg/60 text-accent transition-colors group-hover:border-accent/40 group-hover:bg-accent/10">
                {icon}
              </span>
            ) : null}
          </div>

          <h3
            className={`m-0 text-balance font-display font-semibold leading-snug tracking-[-0.018em] text-ink ${wide ? "max-w-[28ch] text-[clamp(22px,2.8vw,30px)]" : "max-w-[22ch] text-[clamp(19px,2.2vw,24px)]"}`}
          >
            {title}
          </h3>

          {wide ? (
            <div className="mt-auto rounded-xl border border-accent/25 bg-accent/8 px-3.5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-accent md:max-w-[36ch]">
              ✓ {payoff}
            </div>
          ) : null}
        </div>

        {visual ? <div className={wide ? "md:self-stretch" : "mt-auto"}>{visual}</div> : null}

        {!wide ? (
          <div className="mt-auto rounded-xl border border-accent/25 bg-accent/8 px-3.5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-accent">
            ✓ {payoff}
          </div>
        ) : null}
      </div>
    </article>
  );
}

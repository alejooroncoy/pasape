import type { ReactNode } from "react";

type Props = {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
};

export function SectionHeader({
  eyebrow,
  title,
  lede,
  align = "left",
}: Props) {
  const alignCls = align === "center" ? "text-center mx-auto" : "";
  return (
    <header className={align === "center" ? "text-center" : ""}>
      <p
        className={`m-0 mb-[18px] font-serif italic text-base font-normal text-accent ${alignCls}`.trim()}
      >
        {eyebrow}
      </p>
      <h2
        className={`m-0 max-w-[22ch] text-balance font-display font-semibold text-[clamp(34px,5.2vw,60px)] leading-[1.04] tracking-[-0.03em] text-ink [&_em]:font-serif [&_em]:italic [&_em]:font-normal [&_em]:tracking-[-0.02em] [&_em]:text-accent [&_em]:[text-shadow:0_0_28px_var(--color-accent-glow)] ${alignCls}`.trim()}
      >
        {title}
      </h2>
      {lede ? (
        <p
          className={`mt-[22px] max-w-[60ch] text-pretty font-body text-[clamp(16px,1.6vw,19px)] leading-[1.55] text-ink-2 ${alignCls}`.trim()}
        >
          {lede}
        </p>
      ) : null}
    </header>
  );
}

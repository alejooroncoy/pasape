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
  const centered = align === "center";
  const textAlign = centered ? "text-center" : "text-center md:text-left";
  const blockAlign = centered ? "mx-auto" : "mx-auto md:mx-0";

  return (
    <header className={textAlign}>
      <p
        className={`m-0 mb-[18px] font-serif text-base font-normal italic text-accent ${blockAlign}`.trim()}
      >
        {eyebrow}
      </p>
      <h2
        className={`m-0 max-w-[22ch] text-balance font-display text-[clamp(30px,8vw,60px)] font-semibold leading-[1.06] tracking-[-0.03em] text-ink [&_em]:font-serif [&_em]:font-normal [&_em]:italic [&_em]:tracking-[-0.02em] [&_em]:text-accent [&_em]:[text-shadow:0_0_28px_var(--color-accent-glow)] ${textAlign} ${blockAlign}`.trim()}
      >
        {title}
      </h2>
      {lede ? (
        <p
          className={`mt-[22px] max-w-[60ch] text-pretty font-body text-[clamp(15px,4vw,19px)] leading-[1.55] text-ink-2 ${textAlign} ${blockAlign}`.trim()}
        >
          {lede}
        </p>
      ) : null}
    </header>
  );
}

import type { ReactNode } from "react";
import type { EventCategory } from "@/server/events/domain/Event";
import { CATEGORY_BY_ID } from "@/app/[locale]/_home/categories";

type Props = {
  h1: string;
  description: string;
  breadcrumbs?: ReactNode;
  category?: EventCategory | null;
};

export function SeoBrowseLead({ h1, description, breadcrumbs, category = null }: Props) {
  const cat = category ? CATEGORY_BY_ID[category] : null;
  const accent = cat?.color ?? "#b87cff";
  const Icon = cat?.Icon;

  return (
    <section className="px-[clamp(20px,4vw,56px)] pt-5 lg:pt-6">
      <div className="mx-auto max-w-[1320px]">
        {breadcrumbs}
        <div className={`flex items-center gap-3 ${breadcrumbs ? "mt-2.5" : ""}`}>
          {Icon ? (
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] backdrop-blur-sm"
              style={{ background: `${accent}14`, color: accent }}
              aria-hidden
            >
              <Icon width={17} height={17} />
            </span>
          ) : (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: accent, boxShadow: `0 0 12px ${accent}66` }}
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="m-0 font-sans text-[clamp(20px,2.6vw,28px)] font-semibold tracking-[-0.03em] leading-[1.15]">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(120deg, ${accent} 0%, rgba(255,255,255,0.95) 72%)`,
                }}
              >
                {h1}
              </span>
            </h1>
            <p className="sr-only">{description}</p>
          </div>
        </div>
        <div
          className="mt-3.5 h-px w-full max-w-[96px]"
          style={{ background: `linear-gradient(90deg, ${accent}99, transparent)` }}
          aria-hidden
        />
      </div>
    </section>
  );
}

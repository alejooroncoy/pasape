"use client";

import type { EventCategory } from "@/server/events/domain/Event";
import { CATEGORIES } from "./categories";

type Props = {
  selected: EventCategory | null;
  onChange: (cat: EventCategory | null) => void;
};

export function CategoriesSection({ selected, onChange }: Props) {
  return (
    <section id="categorias" className="pt-[clamp(24px,3vw,36px)] pb-2">
      <div
        className="flex gap-2 overflow-x-auto"
        style={{
          paddingLeft: "calc(clamp(20px, 4vw, 56px) + max(0px, (100vw - 1320px) / 2))",
          paddingRight: "clamp(20px, 4vw, 56px)",
          scrollbarWidth: "none",
        }}
      >
        <button
          onClick={() => onChange(null)}
          className={`flex-shrink-0 rounded-full border px-4 py-[7px] text-[13px] font-medium transition-colors duration-150 ${
            selected === null
              ? "border-cart-accent bg-cart-accent/15 text-cart-ink"
              : "border-cart-line bg-transparent text-cart-ink/50 hover:border-cart-ink/25 hover:text-cart-ink/75"
          }`}
        >
          Todos
        </button>

        {CATEGORIES.map(({ id, label, Icon, color }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              onClick={() => onChange(active ? null : id)}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border px-4 py-[7px] text-[13px] font-medium transition-colors duration-150"
              style={{
                borderColor: active ? color : "var(--color-cart-line)",
                background: active ? `${color}26` : "transparent",
                color: active ? "var(--color-cart-ink)" : "var(--color-cart-ink-3)",
              }}
            >
              <span className="text-[14px]" style={{ color: active ? color : "var(--color-cart-ink-4)" }}>
                <Icon />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import type { EventCategory } from "@/server/events/domain/Event";
import { AfterIcon, ComedyIcon, CultureIcon, DjIcon, MusicIcon, SportIcon } from "./icons";

type CatDef = { id: EventCategory; name: string; Icon: React.FC };

const CATS: CatDef[] = [
  { id: "musica",       name: "Música",       Icon: MusicIcon   },
  { id: "dj_sets",      name: "DJ Sets",      Icon: DjIcon      },
  { id: "after_office", name: "After-office",  Icon: AfterIcon   },
  { id: "comedia",      name: "Comedia",       Icon: ComedyIcon  },
  { id: "cultura",      name: "Cultura",       Icon: CultureIcon },
  { id: "deportes",     name: "Deportes",      Icon: SportIcon   },
];

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
              ? "border-cart-accent bg-cart-accent/15 text-white"
              : "border-cart-line bg-transparent text-white/50 hover:border-white/25 hover:text-white/75"
          }`}
        >
          Todos
        </button>

        {CATS.map(({ id, name, Icon }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              onClick={() => onChange(active ? null : id)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-4 py-[7px] text-[13px] font-medium transition-colors duration-150 ${
                active
                  ? "border-cart-accent bg-cart-accent/15 text-white"
                  : "border-cart-line bg-transparent text-white/50 hover:border-white/25 hover:text-white/75"
              }`}
            >
              <span className={`text-[14px] ${active ? "text-cart-accent" : "text-white/40"}`}>
                <Icon />
              </span>
              {name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
